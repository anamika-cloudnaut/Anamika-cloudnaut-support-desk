#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { SupportDeskStack } from '../lib/support-desk-stack';
import { GithubOidcStack } from '../lib/github-oidc-stack';

/**
 * App entry point for the Cloudnaut Support Desk infrastructure.
 *
 * Mirrors the cdk-intro conventions: the entry point's only job is to decide
 * which stacks exist and what props each gets. Two environments (dev/prod) are
 * two objects built from the same class — no duplicated directories.
 */
const app = new cdk.App();

// Optional owner prefix so several people can share one AWS account without
// colliding on stack names:
//   cdk deploy --all -c owner=asd  ->  AsdSupportDeskDev / AsdSupportDeskProd
//   cdk deploy --all               ->  SupportDeskDev / SupportDeskProd
// Pass the same owner value to deploy and destroy, or you will not target your
// own stacks.
const owner = app.node.tryGetContext('owner') as string | undefined;
const prefix = owner ? owner.charAt(0).toUpperCase() + owner.slice(1).toLowerCase() : '';

// Optional SES sender address for password-reset email. Must be a verified SES
// identity (or belong to a verified domain). Omit to skip email wiring.
//   cdk deploy -c senderEmail=support@yourdomain.com
const senderEmail = app.node.tryGetContext('senderEmail') as string | undefined;

// Account/region are resolved from the current CLI profile at deploy time.
// Synth works offline without them; VPC/AZ lookups need them at deploy time.
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new SupportDeskStack(app, `${prefix}SupportDeskDev`, {
  env,
  stage: 'dev',
  senderEmail,
  description: 'Cloudnaut Support Desk — dev environment',
});

new SupportDeskStack(app, `${prefix}SupportDeskProd`, {
  env,
  stage: 'prod',
  senderEmail,
  description: 'Cloudnaut Support Desk — prod environment',
});

// One-time: lets GitHub Actions deploy via OIDC (no long-lived keys in GitHub).
new GithubOidcStack(app, `${prefix}GithubOidc`, {
  env,
  repo: 'anamika-cloudnaut/Anamika-cloudnaut-support-desk',
  description: 'GitHub Actions OIDC provider + deploy role',
});
