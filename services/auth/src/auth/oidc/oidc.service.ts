import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Client, generators, Issuer } from 'openid-client';
import type { AuthTokenResponse } from '@learn-and-build/types';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { OidcConfigService, type OidcProviderConfig } from './oidc-config.service';

interface AuthTransaction {
  slug: string;
  nonce: string;
  codeVerifier: string;
  createdAt: number;
}

const TX_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private readonly clients = new Map<string, Client>();
  // Short-lived login transactions keyed by `state`. In-memory is fine for a
  // single instance; back this with Redis for a multi-instance deployment.
  private readonly transactions = new Map<string, AuthTransaction>();

  constructor(
    private readonly config: OidcConfigService,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  private requireProvider(slug: string): OidcProviderConfig {
    const provider = this.config.getProvider(slug);
    if (!provider) {
      throw new NotFoundException(`OIDC provider '${slug}' is not configured`);
    }
    return provider;
  }

  private async getClient(provider: OidcProviderConfig): Promise<Client> {
    const cached = this.clients.get(provider.slug);
    if (cached) return cached;

    const issuer = await Issuer.discover(provider.issuer);
    const client = new issuer.Client({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uris: [this.config.redirectUri(provider.slug)],
      response_types: ['code'],
    });
    this.clients.set(provider.slug, client);
    return client;
  }

  /** Builds the provider authorization URL and records the login transaction. */
  async createAuthorizationUrl(slug: string): Promise<string> {
    const provider = this.requireProvider(slug);
    const client = await this.getClient(provider);

    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    this.pruneTransactions();
    this.transactions.set(state, {
      slug,
      nonce,
      codeVerifier,
      createdAt: Date.now(),
    });

    return client.authorizationUrl({
      scope: provider.scope,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
  }

  /** Exchanges the callback params for tokens and issues a platform JWT. */
  async handleCallback(
    slug: string,
    params: Record<string, string>,
  ): Promise<AuthTokenResponse> {
    const provider = this.requireProvider(slug);
    const client = await this.getClient(provider);

    const state = params.state;
    const tx = state ? this.transactions.get(state) : undefined;
    if (!tx || tx.slug !== slug) {
      throw new BadRequestException('Invalid or expired login state');
    }
    this.transactions.delete(state);

    const tokenSet = await client.callback(
      this.config.redirectUri(slug),
      params,
      { state, nonce: tx.nonce, code_verifier: tx.codeVerifier },
    );

    const claims = tokenSet.claims();
    if (!claims.email) {
      throw new BadRequestException('Provider did not return an email claim');
    }

    const user = await this.users.findOrCreateOAuthUser({
      provider: provider.id,
      providerSubject: claims.sub,
      email: String(claims.email),
      displayName: String(claims.name ?? claims.email),
    });

    this.logger.log(`OIDC login via ${slug} for ${user.email}`);
    return this.auth.issueTokenFor(user);
  }

  private pruneTransactions(): void {
    const now = Date.now();
    for (const [state, tx] of this.transactions) {
      if (now - tx.createdAt > TX_TTL_MS) {
        this.transactions.delete(state);
      }
    }
  }
}
