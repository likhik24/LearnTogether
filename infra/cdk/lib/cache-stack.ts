import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export interface CacheStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

/**
 * ElastiCache for Redis. Skeleton: single-node cluster in isolated subnets.
 */
export class CacheStack extends cdk.Stack {
  public readonly cluster: elasticache.CfnCacheCluster;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'SubnetGroup', {
      description: 'Learn&Build Redis subnet group',
      subnetIds: props.vpc.isolatedSubnets.map((s) => s.subnetId),
    });

    const securityGroup = new ec2.SecurityGroup(this, 'RedisSg', {
      vpc: props.vpc,
      description: 'Learn&Build Redis access',
      allowAllOutbound: true,
    });

    this.cluster = new elasticache.CfnCacheCluster(this, 'Redis', {
      engine: 'redis',
      cacheNodeType: 'cache.t3.micro',
      numCacheNodes: 1,
      cacheSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: [securityGroup.securityGroupId],
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.cluster.attrRedisEndpointAddress,
    });
  }
}
