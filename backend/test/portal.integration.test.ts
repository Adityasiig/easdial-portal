import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-32-characters';
process.env.EASDIAL_ADMIN_EMAIL = 'admin@easdial.test';
process.env.EASDIAL_ADMIN_PASSWORD = 'Admin-Test-Password!';
process.env.PEEREDGE_SOURCE = 'mock';
delete process.env.DATABASE_URL;

const { buildServer } = await import('../src/server.js');

test('admin-created customer is scoped, functional, and revocable', async () => {
  const { app } = await buildServer();
  await app.ready();

  try {
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@easdial.test', password: 'Admin-Test-Password!' },
    });
    assert.equal(adminLogin.statusCode, 200);
    const admin = adminLogin.json<{ token: string; user: { id: string; role: string } }>();
    assert.equal(admin.user.role, 'admin');
    const adminHeaders = { authorization: `Bearer ${admin.token}` };

    const wrongCurrentPassword = await app.inject({
      method: 'PATCH',
      url: '/admin/account',
      headers: adminHeaders,
      payload: { currentPassword: 'wrong-current-password', email: 'admin-renamed@easdial.test' },
    });
    assert.equal(wrongCurrentPassword.statusCode, 401);

    const accountUpdate = await app.inject({
      method: 'PATCH',
      url: '/admin/account',
      headers: adminHeaders,
      payload: {
        currentPassword: 'Admin-Test-Password!',
        email: 'admin-renamed@easdial.test',
        password: 'Admin-Renamed-Password!',
      },
    });
    assert.equal(accountUpdate.statusCode, 200);
    assert.equal(accountUpdate.json<{ user: { email: string } }>().user.email, 'admin-renamed@easdial.test');

    const oldAdminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@easdial.test', password: 'Admin-Test-Password!' },
    });
    assert.equal(oldAdminLogin.statusCode, 401);
    const renamedAdminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin-renamed@easdial.test', password: 'Admin-Renamed-Password!' },
    });
    assert.equal(renamedAdminLogin.statusCode, 200);

    const relationshipsResponse = await app.inject({
      method: 'GET',
      url: '/admin/relationships',
      headers: adminHeaders,
    });
    assert.equal(relationshipsResponse.statusCode, 200);
    const relationships = relationshipsResponse.json<Array<{ id: string; name: string }>>();
    assert.ok(relationships.length > 0);
    const relationship = relationships[0];

    const shortPasswordResponse = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: adminHeaders,
      payload: {
        email: 'invalid-password@easdial.test',
        password: 'short',
        relationshipId: relationship.id,
        relationshipName: relationship.name,
      },
    });
    assert.equal(shortPasswordResponse.statusCode, 400);
    assert.equal(
      shortPasswordResponse.json<{ error: { message: string } }>().error.message,
      'Password must be at least 8 characters',
    );

    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: adminHeaders,
      payload: {
        email: 'qa-customer@easdial.test',
        password: 'Customer-Test-Password!',
        relationshipId: relationship.id,
        relationshipName: relationship.name,
      },
    });
    assert.equal(createResponse.statusCode, 200);
    const created = createResponse.json<{ user: { id: string; relationshipId: string; role: string } }>().user;
    assert.equal(created.role, 'user');
    assert.equal(created.relationshipId, relationship.id);

    const duplicateResponse = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: adminHeaders,
      payload: {
        email: 'qa-customer@easdial.test',
        password: 'Customer-Test-Password!',
        relationshipId: relationship.id,
        relationshipName: relationship.name,
      },
    });
    assert.equal(duplicateResponse.statusCode, 400);

    const customerLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'qa-customer@easdial.test', password: 'Customer-Test-Password!' },
    });
    assert.equal(customerLogin.statusCode, 200);
    const customer = customerLogin.json<{ token: string }>();
    const customerHeaders = { authorization: `Bearer ${customer.token}` };

    const summaryResponse = await app.inject({ method: 'GET', url: '/metrics/summary', headers: customerHeaders });
    assert.equal(summaryResponse.statusCode, 200);
    assert.equal(typeof summaryResponse.json<{ dailyAttempts: number }>().dailyAttempts, 'number');

    const headerStatsResponse = await app.inject({
      method: 'GET',
      url: '/metrics/header-stats',
      headers: customerHeaders,
    });
    assert.equal(headerStatsResponse.statusCode, 200);
    const headerStats = headerStatsResponse.json<{ activeCalls: number; activeCps: number }>();
    assert.equal(typeof headerStats.activeCalls, 'number');
    assert.equal(typeof headerStats.activeCps, 'number');

    const filterResponse = await app.inject({
      method: 'GET',
      url: '/metrics/cdr-filters?direction=termination',
      headers: customerHeaders,
    });
    assert.equal(filterResponse.statusCode, 200);
    const cdrFilters = filterResponse.json<{
      locations: string[];
      customerTrunkGroups: Array<{ id: string }>;
      vendorTrunkGroups: Array<{ id: string }>;
    }>();
    assert.ok(cdrFilters.locations.length > 0);
    assert.ok(cdrFilters.customerTrunkGroups.length > 0);
    assert.equal(cdrFilters.vendorTrunkGroups.length, 0);

    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);
    const query = new URLSearchParams({
      direction: 'termination',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: 'all',
      location: cdrFilters.locations[0],
      customerTrunkGroupId: cdrFilters.customerTrunkGroups[0].id,
    });
    const cdrResponse = await app.inject({ method: 'GET', url: `/metrics/cdrs?${query}`, headers: customerHeaders });
    assert.equal(cdrResponse.statusCode, 200);
    const cdrRows = cdrResponse.json<Array<{ customerTrunk: string; vendorTrunk: string }>>();
    assert.ok(cdrRows.length > 0);
    assert.match(cdrRows[0].customerTrunk, /USA SD$/);
    assert.equal(cdrRows[0].vendorTrunk, '');

    const ratesResponse = await app.inject({ method: 'GET', url: '/metrics/rates', headers: customerHeaders });
    assert.equal(ratesResponse.statusCode, 200);
    const rates = ratesResponse.json<Array<{ id: string; name: string; relationship: string }>>();
    assert.ok(rates.length > 0);
    assert.ok(rates.some((rate) => rate.relationship === 'Customer'));
    assert.ok(rates.some((rate) => rate.relationship === 'Vendor'));

    for (const rate of rates) {
      const rateDownloadResponse = await app.inject({
        method: 'GET',
        url: `/metrics/rates/${encodeURIComponent(rate.id)}/download`,
        headers: customerHeaders,
      });
      assert.equal(rateDownloadResponse.statusCode, 200, rate.name);
      assert.match(rateDownloadResponse.headers['content-type'] ?? '', /text\/csv/);
      assert.match(rateDownloadResponse.headers['content-disposition'] ?? '', /attachment; filename=/);
      assert.match(rateDownloadResponse.body, /"Prefix","Interstate Rate","Intrastate Rate"/);
    }

    const unauthorizedDeckResponse = await app.inject({
      method: 'GET',
      url: '/metrics/rates/not-this-customers-deck/download',
      headers: customerHeaders,
    });
    assert.equal(unauthorizedDeckResponse.statusCode, 404);

    const forbiddenAdminResponse = await app.inject({ method: 'GET', url: '/admin/users', headers: customerHeaders });
    assert.equal(forbiddenAdminResponse.statusCode, 403);

    const deleteAdminResponse = await app.inject({
      method: 'DELETE',
      url: `/admin/users/${admin.user.id}`,
      headers: adminHeaders,
    });
    assert.equal(deleteAdminResponse.statusCode, 400);

    const deleteResponse = await app.inject({ method: 'DELETE', url: `/admin/users/${created.id}`, headers: adminHeaders });
    assert.equal(deleteResponse.statusCode, 200);

    const deletedSessionResponse = await app.inject({ method: 'GET', url: '/auth/me', headers: customerHeaders });
    assert.equal(deletedSessionResponse.statusCode, 401);
  } finally {
    await app.close();
  }
});
