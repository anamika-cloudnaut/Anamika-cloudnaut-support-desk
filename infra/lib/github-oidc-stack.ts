import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface GithubOidcStackProps extends cdk.StackProps {
  /** e.g. "anamika-cloudnaut/Anamika-cloudnaut-support-desk" */
  readonly repo: string;
}

/**
 * One-time setup so GitHub Actions can deploy via OIDC — no long-lived AWS
 * keys stored in GitHub. Creates:
 *   - an IAM OIDC provider trusting GitHub's token issuer, and
 *   - a deploy role that only this repo's workflows can assume.
 *
 * The role is allowed to assume the CDK bootstrap roles (cdk-*-deploy-role,
 * file-publishing, image-publishing, lookup), which is exactly what
 * `cdk deploy` needs. That keeps the role's own permissions minimal while still
 * being able to deploy the app stack.
 */
export class GithubOidcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GithubOidcStackProps) {
    super(scope, id, props);

    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const deployRole = new iam.Role(this, 'GithubDeployRole', {
      roleName: 'github-actions-deploy',
      description: 'Assumed by GitHub Actions (OIDC) to run cdk deploy',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          // Only workflows from this repo (any branch) may assume the role.
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${props.repo}:*`,
          },
        },
      ),
    });

    // Allow assuming the CDK bootstrap roles so `cdk deploy` works. These are
    // the roles created by `cdk bootstrap` (qualifier hnb659fds by default).
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
    );
    // CDK also reads bootstrap info from SSM at deploy time.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/cdk-bootstrap/*`],
      }),
    );

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Set this as the role-to-assume in the GitHub Actions CD workflow.',
    });
  }
}
