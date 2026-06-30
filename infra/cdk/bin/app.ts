#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { SearchStack } from '../lib/search-stack';
import { CacheStack } from '../lib/cache-stack';
import { StorageStack } from '../lib/storage-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const prefix = app.node.tryGetContext('prefix') ?? 'LearnBuild';

// Shared network (VPC) used by data-tier stacks.
const network = new NetworkStack(app, `${prefix}-Network`, { env });

new DatabaseStack(app, `${prefix}-Database`, { env, vpc: network.vpc });
new SearchStack(app, `${prefix}-Search`, { env, vpc: network.vpc });
new CacheStack(app, `${prefix}-Cache`, { env, vpc: network.vpc });
new StorageStack(app, `${prefix}-Storage`, { env });

app.synth();
