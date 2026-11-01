/**
 * Creates the first SUPER_ADMIN. Run once per environment:
 *   pnpm --filter @acee/api provision:superadmin -- --email owner@example.com --name "Owner" --mobile 9xxxxxxxxx
 * The password is read from the SUPERADMIN_PASSWORD env var so it never lands in shell history.
 */
import { parseArgs } from 'node:util';
import { password as passwordRule, indianMobile } from '@acee/shared';
import { prisma } from '../src/db';
import { hashPassword } from '../src/lib/auth';
import { audit } from '../src/lib/audit';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, mobile: { type: 'string' } } });
const pw = process.env.SUPERADMIN_PASSWORD ?? '';
if (!values.email || !values.name || !values.mobile) throw new Error('--email, --name and --mobile are required');
passwordRule.parse(pw);
indianMobile.parse(values.mobile);

const u = await prisma.user.create({
  data: { email: values.email.toLowerCase(), fullName: values.name, mobile: values.mobile, role: 'SUPER_ADMIN', passwordHash: await hashPassword(pw), emailVerifiedAt: new Date() },
});
await audit(prisma, { actorId: null, action: 'user.provision_superadmin', entityType: 'User', entityId: u.id });
console.log(`SUPER_ADMIN created: ${u.email}`);
await prisma.$disconnect();
