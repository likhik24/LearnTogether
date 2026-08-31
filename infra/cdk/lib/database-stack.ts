import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

/**
 * RDS PostgreSQL instance. PostGIS is enabled at the database level
 * (CREATE EXTENSION postgis) by the schema migration once the instance is up
 * (see deploy/migrations/0001_init_schema.sql). Services connect with
 * DB_SYNCHRONIZE=false and rely on that migration as the source of truth.
 *
 * Data-safety posture is controlled by the `prod` context flag so the same
 * stack can be a disposable dev instance or a protected production one:
 *   cdk deploy -c prod=true   -> deletion protection on, snapshot on removal,
 *                                multi-AZ, 7-day backups
 *   cdk deploy                -> disposable single-AZ instance (destroyed on
 *                                stack deletion), suitable for dev/test
 *
 * Production hardening still to consider outside this construct: a read
 * replica, Performance Insights, enhanced monitoring, and pinning the RDS CA
 * bundle in the services/migration runner instead of relaxing TLS verification.
 */
export class DatabaseStack extends cdk.Stack {
  public readonly instance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const isProd = this.node.tryGetContext('prod') === true ||
      this.node.tryGetContext('prod') === 'true';

    this.instance = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        isProd ? ec2.InstanceSize.SMALL : ec2.InstanceSize.MICRO,
      ),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      multiAz: isProd,
      backupRetention: isProd ? cdk.Duration.days(7) : cdk.Duration.days(1),
      databaseName: 'learnbuild',
      credentials: rds.Credentials.fromGeneratedSecret('learnbuild'),
      // Protect production data from accidental teardown; keep dev disposable.
      removalPolicy: isProd
        ? cdk.RemovalPolicy.SNAPSHOT
        : cdk.RemovalPolicy.DESTROY,
      deletionProtection: isProd,
    });

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.instance.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.instance.secret?.secretArn ?? 'none',
    });
  }
}
