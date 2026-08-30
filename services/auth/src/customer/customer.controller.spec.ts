import type { Request } from 'express';
import { downstreamAuthorization } from './customer.controller';

describe('customer downstream authorization', () => {
  it('forwards an explicit bearer token', () => {
    const request = { headers: { authorization: 'Bearer api-token' } } as Request;
    expect(downstreamAuthorization(request)).toBe('Bearer api-token');
  });

  it('converts the secure browser access cookie to a bearer token', () => {
    const request = { headers: { cookie: 'other=value; lt_access=cookie-token' } } as Request;
    expect(downstreamAuthorization(request)).toBe('Bearer cookie-token');
  });
});
