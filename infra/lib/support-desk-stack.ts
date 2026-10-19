import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as path from 'node:path';

export type Stage = 'dev' | 'prod';

export interface SupportDeskStackProps extends cdk.StackProps {
  readonly stage: Stage;
  /**
   * Verified SES sender address for outbound email (password resets).
   * Pass via context: `cdk deploy -c senderEmail=support@yourdomain.com`.
   * Optional — if omitted, SES wiring is skipped and password-reset email is
   * simply unavailable (the rest of the app works). SES requires this address
   * (or its domain) to be verified, and new accounts are sandboxed.
   */
  readonly senderEmail?: string;
}

/**
 * Per-environment variation lives in one table rather than scattered
 * `if (stage === 'prod')` branches (same approach as cdk-intro).
 *
 * Deliberately NOT here: removal policies and S3 public-access blocking —
 * those safety settings stay identical across environments.
 */
interface StageConfig {
  /** NAT gateways cost money; dev uses 1, prod uses 2 for AZ resilience. */
  readonly natGateways: number;
  /** RDS instance size. */
  readonly dbInstanceType: ec2.InstanceType;
  /** Multi-AZ RDS for prod resilience; single-AZ for cheap dev. */
  readonly dbMultiAz: boolean;
  /** Allocated DB storage in GB. */
  readonly dbAllocatedStorageGb: number;
  /** Fargate task CPU units (256 = 0.25 vCPU) for the app services. */
  readonly taskCpu: number;
  /** Fargate task memory (MiB) for the app services. */
  readonly taskMemory: number;
  /** Desired running count per app service. */
  readonly desiredCount: number;
  /** CloudWatch log retention. */
  readonly logRetention: logs.RetentionDays;
}

const STAGE_CONFIG: Record<Stage, StageConfig> = {
  dev: {
    natGateways: 1,
    dbInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
    dbMultiAz: false,
    dbAllocatedStorageGb: 20,
    taskCpu: 256,
    taskMemory: 512,
    desiredCount: 1,
    logRetention: logs.RetentionDays.ONE_WEEK,
  },
  prod: {
    natGateways: 2,
    dbInstanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
    dbMultiAz: true,
    dbAllocatedStorageGb: 50,
    taskCpu: 512,
    taskMemory: 1024,
    desiredCount: 2,
    logRetention: logs.RetentionDays.ONE_MONTH,
  },
};

// Repo root relative to this file (infra/lib -> ../..). Docker build contexts
// mirror docker-compose.yml: the api builds from workspace/api, while the
// backend builds from the repo root (it copies workspace/backend + workspace/database).
const REPO_ROOT = path.join(__dirname, '..', '..');

export class SupportDeskStack extends cdk.Stack {
  public readonly stage: Stage;

  // Phase 1 — Foundations
  public readonly vpc: ec2.Vpc;
  public readonly attachmentsBucket: s3.Bucket;
  public readonly database: rds.DatabaseInstance;
  public readonly authSecret: secretsmanager.Secret;
  public readonly dbSecret: secretsmanager.ISecret;

  // Phase 2 handles referenced by Phase 4 (SES wiring)
  private backendContainer!: ecs.ContainerDefinition;
  private backendTaskRole!: iam.IRole;

  constructor(scope: Construct, id: string, props: SupportDeskStackProps) {
    super(scope, id, props);

    this.stage = props.stage;
    const config = STAGE_CONFIG[props.stage];

    // Tag everything for cost allocation (Tags.of covers the whole subtree).
    cdk.Tags.of(this).add('Stage', props.stage);
    cdk.Tags.of(this).add('Project', 'cloudnaut-support-desk');

    // dev is disposable; prod protects stateful resources from accidental loss.
    const removalPolicy =
      props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // ---------------------------------------------------------------------
    // NETWORK — VPC with public + private subnets
    // ---------------------------------------------------------------------
    // Public subnets: ALB (added in Phase 2).
    // Private (with egress): Fargate tasks — reach the internet via NAT to
    //   pull images / call SES, but are not publicly reachable.
    // Isolated: RDS — no internet route at all.
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: config.natGateways,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // ---------------------------------------------------------------------
    // STORAGE — S3 bucket for ticket attachments (replaces MinIO)
    // ---------------------------------------------------------------------
    this.attachmentsBucket = new s3.Bucket(this, 'AttachmentsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: props.stage === 'prod',
      removalPolicy,
      // Only auto-empty on destroy in dev; prod retains, so never auto-delete.
      autoDeleteObjects: props.stage !== 'prod',
    });

    // ---------------------------------------------------------------------
    // SECRETS — app auth secret + DB credentials
    // ---------------------------------------------------------------------
    // AUTH_SECRET_KEY: generate a strong random value AWS stores for us,
    // instead of committing it to a .env file.
    this.authSecret = new secretsmanager.Secret(this, 'AuthSecret', {
      description: 'Support Desk AUTH_SECRET_KEY (JWT signing)',
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: true,
      },
    });

    // ---------------------------------------------------------------------
    // DATABASE — RDS PostgreSQL in isolated subnets
    // ---------------------------------------------------------------------
    this.database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: config.dbInstanceType,
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      multiAz: config.dbMultiAz,
      allocatedStorage: config.dbAllocatedStorageGb,
      // CDK generates and stores the master credentials in Secrets Manager.
      credentials: rds.Credentials.fromGeneratedSecret('cloudnaut', {
        secretName: `${id}/db-credentials`,
      }),
      databaseName: 'cloudnaut_db',
      removalPolicy,
      deletionProtection: props.stage === 'prod',
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(props.stage === 'prod' ? 7 : 1),
    });

    // The RDS-generated secret (username/password/host/port/dbname) that the
    // backend consumes below.
    this.dbSecret = this.database.secret!;

    // =====================================================================
    // COGNITO — User Pool for authentication (defined before compute so the
    // api/backend containers and the frontend build can reference its IDs)
    // =====================================================================
    // Roles are modelled as Cognito groups (employee/support/admin) that appear
    // in the token's `cognito:groups` claim. MFA is TOTP and OPTIONAL.
    // Verified SES sender used for Cognito emails (reset codes) and app emails.
    const senderEmail = props.senderEmail || 'admin@cloudnaut.com';
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${id}-users`,
      selfSignUpEnabled: false, // accounts are created by an admin (as today)
      signInAliases: { email: true },
      autoVerify: { email: true },
      // Cognito sends reset codes / invites via SES from the verified sender.
      email: cognito.UserPoolEmail.withSES({
        fromEmail: senderEmail,
        sesRegion: this.region,
      }),
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true }, // TOTP (authenticator app)
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('SpaClient', {
      userPoolClientName: `${id}-spa`,
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },
      accessTokenValidity: cdk.Duration.hours(8),
      idTokenValidity: cdk.Duration.hours(8),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // Role groups. Lower precedence number = higher priority when a user is in
    // several groups: admin > support > employee.
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId, groupName: 'admin', precedence: 1, description: 'Administrators',
    });
    new cognito.CfnUserPoolGroup(this, 'SupportGroup', {
      userPoolId: userPool.userPoolId, groupName: 'support', precedence: 2, description: 'Support team',
    });
    new cognito.CfnUserPoolGroup(this, 'EmployeeGroup', {
      userPoolId: userPool.userPoolId, groupName: 'employee', precedence: 3, description: 'Staff / employees',
    });

    // =====================================================================
    // PHASE 2 — COMPUTE: ECS Fargate (api + backend) behind an ALB
    // =====================================================================

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: this.vpc,
      containerInsightsV2: props.stage === 'prod'
        ? ecs.ContainerInsights.ENABLED
        : ecs.ContainerInsights.DISABLED,
    });

    // Internal service-discovery namespace so the api reaches the backend by a
    // stable DNS name (backend.support.local). Must exist before any service
    // sets cloudMapOptions.
    cluster.addDefaultCloudMapNamespace({ name: 'support.local' });

    // Docker images built from the existing Dockerfiles at deploy time and
    // pushed to an ECR repo CDK manages. Build contexts match docker-compose.
    const backendImage = ecs.ContainerImage.fromAsset(REPO_ROOT, {
      file: 'workspace/backend/Dockerfile',
    });
    const apiImage = ecs.ContainerImage.fromAsset(
      path.join(REPO_ROOT, 'workspace', 'api'),
      { file: 'Dockerfile' },
    );

    // Build the SQLAlchemy URL from the RDS-generated secret fields.
    //
    // This renders as a CloudFormation `{{resolve:secretsmanager:...}}` dynamic
    // reference, so the password is NOT stored in the template or in git — it is
    // resolved at deploy time. Tradeoff: the resolved value lands in the task's
    // plaintext environment (visible via describe-task-definition). The backend
    // expects a single DATABASE_URL string, so this is the pragmatic path.
    // HARDENING (later): store the assembled URL in its own Secrets Manager
    // secret and inject via ecs.Secret so it never appears as an env var.
    const dbCreds = this.dbSecret;
    const databaseUrl = `postgresql+psycopg2://${dbCreds
      .secretValueFromJson('username')
      .unsafeUnwrap()}:${dbCreds
      .secretValueFromJson('password')
      .unsafeUnwrap()}@${this.database.dbInstanceEndpointAddress}:5432/cloudnaut_db`;

    // --- Backend service (internal, port 8001) --------------------------
    const backendTaskDef = new ecs.FargateTaskDefinition(this, 'BackendTaskDef', {
      cpu: config.taskCpu,
      memoryLimitMiB: config.taskMemory,
    });

    this.backendTaskRole = backendTaskDef.taskRole;
    const backendContainer = backendTaskDef.addContainer('backend', {
      image: backendImage,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'backend',
        logRetention: config.logRetention,
      }),
      portMappings: [{ containerPort: 8001 }],
      environment: {
        DATABASE_URL: databaseUrl,
        // S3 via the existing MinIO-compatible client: point it at real S3.
        MINIO_ENDPOINT: `s3.${this.region}.amazonaws.com`,
        MINIO_SECURE: 'true',
        MINIO_BUCKET: this.attachmentsBucket.bucketName,
        // Cognito config for token verification (set after the pool exists).
        AWS_REGION: this.region,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        // FRONTEND_URL (used for password-reset email links) is set to the
        // CloudFront URL once the distribution exists — see Phase 3 below.
      },
      secrets: {
        AUTH_SECRET_KEY: ecs.Secret.fromSecretsManager(this.authSecret),
      },
    });
    this.backendContainer = backendContainer;

    const backendService = new ecs.FargateService(this, 'BackendService', {
      cluster,
      taskDefinition: backendTaskDef,
      desiredCount: config.desiredCount,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      // Service discovery so the api can reach the backend by DNS name.
      cloudMapOptions: { name: 'backend' },
      assignPublicIp: false,
    });

    // --- API service (public, port 4000, behind an ALB) ----------------
    const apiService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'ApiService',
      {
        cluster,
        cpu: config.taskCpu,
        memoryLimitMiB: config.taskMemory,
        desiredCount: config.desiredCount,
        publicLoadBalancer: true,
        taskImageOptions: {
          image: apiImage,
          containerPort: 4000,
          environment: {
            // Reach the backend over the internal service-discovery DNS name.
            BACKEND_URL: 'http://backend.support.local:8001',
            AWS_REGION: this.region,
            COGNITO_USER_POOL_ID: userPool.userPoolId,
            COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
          },
          secrets: {
            AUTH_SECRET_KEY: ecs.Secret.fromSecretsManager(this.authSecret),
          },
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'api',
            logRetention: config.logRetention,
          }),
        },
      },
    );

    // The api's /health endpoint for ALB target health checks.
    apiService.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
    });

    // --- Networking wiring ---------------------------------------------
    // api -> backend on 8001
    backendService.connections.allowFrom(
      apiService.service,
      ec2.Port.tcp(8001),
      'Allow api tasks to reach the backend',
    );
    // backend -> RDS on 5432
    this.database.connections.allowFrom(
      backendService,
      ec2.Port.tcp(5432),
      'Allow backend tasks to reach PostgreSQL',
    );

    // Backend reads/writes attachments in S3 (grants least-privilege IAM).
    this.attachmentsBucket.grantReadWrite(backendTaskDef.taskRole);
    // Both services read their secrets.
    this.authSecret.grantRead(backendTaskDef.taskRole);
    this.authSecret.grantRead(apiService.taskDefinition.taskRole);
    this.dbSecret.grantRead(backendTaskDef.taskRole);

    // Backend manages Cognito users when an admin creates/approves accounts
    // (AdminCreateUser + group assignment). Scoped to this user pool only.
    backendTaskDef.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminGetUser',
        ],
        resources: [userPool.userPoolArn],
      }),
    );

    // --- One-off DB migrate/seed task ----------------------------------
    // Not a long-running service: run it manually once after deploy via
    //   aws ecs run-task (see MigrateRunCommand output). Runs
    //   `alembic upgrade head && seed` from workspace/database/Dockerfile.
    const migrateTaskDef = new ecs.FargateTaskDefinition(this, 'MigrateTaskDef', {
      cpu: 256,
      memoryLimitMiB: 512,
    });
    migrateTaskDef.addContainer('migrate', {
      image: ecs.ContainerImage.fromAsset(REPO_ROOT, {
        file: 'workspace/database/Dockerfile',
      }),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'migrate',
        logRetention: config.logRetention,
      }),
      environment: {
        DATABASE_URL: databaseUrl,
      },
    });
    this.dbSecret.grantRead(migrateTaskDef.taskRole);

    // A dedicated security group for the migrate task so RDS can allow it.
    const migrateSg = new ec2.SecurityGroup(this, 'MigrateTaskSg', {
      vpc: this.vpc,
      description: 'One-off DB migrate/seed task',
      allowAllOutbound: true,
    });
    this.database.connections.allowFrom(
      migrateSg,
      ec2.Port.tcp(5432),
      'Allow the migrate task to reach PostgreSQL',
    );

    // =====================================================================
    // PHASE 3 — FRONTEND: S3 + CloudFront (SPA) with /api/* -> ALB
    // =====================================================================
    // Single-origin-feel for the browser: CloudFront serves the static React
    // app at `/`, and forwards `/api/*` to the API ALB. The frontend therefore
    // calls same-origin `/api/...` (no CORS), and VITE_API_URL is the static
    // value `/api` — known at build time, so there is no ALB-DNS-at-synth
    // chicken-and-egg problem.

    // Private bucket holding the built static site; only CloudFront reads it.
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: props.stage !== 'prod',
    });

    // Strip the leading `/api` before the request reaches the ALB, since the
    // API serves its routes at the root (/requests, /auth/login, ...).
    const stripApiPrefix = new cloudfront.Function(this, 'StripApiPrefix', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\\/api/, '');
  if (request.uri === '') { request.uri = '/'; }
  return request;
}
`),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: `Support Desk ${props.stage}`,
      defaultRootObject: 'index.html',
      // Default behaviour: static SPA from S3.
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        // API traffic: forward to the ALB over HTTP, no caching, pass auth
        // headers through. The CloudFront Function rewrites /api/* -> /*.
        'api/*': {
          origin: new origins.LoadBalancerV2Origin(apiService.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [
            {
              function: stripApiPrefix,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      },
      // NOTE: No distribution-wide custom error responses. The app uses
      // state-based navigation (no path-based routing / deep links), so an SPA
      // 403/404 -> index.html fallback is unnecessary — and worse, because
      // CloudFront error responses are global, it would rewrite the API's
      // legitimate 401/403/404 responses into 200 + index.html, breaking auth
      // error handling. Serving index.html at `/` via defaultRootObject is
      // sufficient for this app.
    });

    // Now that the distribution exists, point the backend's FRONTEND_URL at it
    // so password-reset emails link back to the deployed site.
    backendContainer.addEnvironment(
      'FRONTEND_URL',
      `https://${distribution.distributionDomainName}`,
    );

    // Build the React app (with VITE_API_URL=/api) and upload to the bucket.
    // Bundling runs `npm ci && npm run build` inside a Node container, so the
    // deploy is self-contained and does not depend on a local build step.
    //
    // Cognito pool/client IDs are NOT known at build time (they are CFN tokens),
    // so instead of baking them into the bundle we write a runtime config.json
    // into the bucket. The frontend fetches /config.json on startup to learn
    // its Cognito settings. This avoids the token-at-build-time problem.
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      sources: [
        s3deploy.Source.asset(path.join(REPO_ROOT, 'workspace', 'frontend'), {
          bundling: {
            image: cdk.DockerImage.fromRegistry('node:20-alpine'),
            environment: { VITE_API_URL: '/api' },
            command: [
              'sh',
              '-c',
              'npm ci && VITE_API_URL=/api npm run build && cp -r dist/* /asset-output/',
            ],
          },
        }),
        // Runtime config consumed by the frontend (window fetch of /config.json).
        s3deploy.Source.jsonData('config.json', {
          region: this.region,
          userPoolId: userPool.userPoolId,
          userPoolClientId: userPoolClient.userPoolClientId,
          apiUrl: '/api',
        }),
      ],
    });

    // =====================================================================
    // EMAIL — SES (API-based) for ticket confirmations + password resets
    // =====================================================================
    // The backend sends mail via the SES API (boto3), so NO SMTP credentials
    // are needed — the backend task role is granted ses:SendEmail directly.
    //
    // MANUAL STEP (cannot be automated in CDK): the sender identity below must
    // be VERIFIED. For a bare email address, AWS emails a confirmation link
    // that someone must click. New SES accounts are also in the SANDBOX — you
    // can only send to verified recipients until you request production access.
    // (senderEmail is defined above, near the user pool.)
    new ses.EmailIdentity(this, 'SenderIdentity', {
      identity: ses.Identity.email(senderEmail),
    });

    // Backend may send email through SES.
    this.backendTaskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }),
    );

    // Backend reads the sender + region from env (uses boto3 SES client).
    this.backendContainer.addEnvironment('SES_SENDER_EMAIL', senderEmail);
    this.backendContainer.addEnvironment('SES_REGION', this.region);

    new cdk.CfnOutput(this, 'SesSenderEmail', {
      value: senderEmail,
      description: 'VERIFY this address in SES (click the confirmation email) before email will send.',
    });

    // ---------------------------------------------------------------------
    // OUTPUTS
    // ---------------------------------------------------------------------
    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
    new cdk.CfnOutput(this, 'AttachmentsBucketName', {
      value: this.attachmentsBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.database.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: this.dbSecret.secretArn });
    new cdk.CfnOutput(this, 'AuthSecretArn', { value: this.authSecret.secretArn });
    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Public site (CloudFront). Serves the React app and proxies /api/* to the ALB.',
    });
    new cdk.CfnOutput(this, 'ApiAlbUrl', {
      value: `http://${apiService.loadBalancer.loadBalancerDnsName}`,
      description: 'Direct ALB endpoint (origin behind CloudFront). Normally reached via /api on the site URL.',
    });
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'MigrateTaskDefArn', {
      value: migrateTaskDef.taskDefinitionArn,
      description: 'Run once after deploy with: aws ecs run-task --cluster <ClusterName> --task-definition <this> --launch-type FARGATE --network-configuration ...',
    });
  }
}
