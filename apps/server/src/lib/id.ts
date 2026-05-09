import { customAlphabet } from 'nanoid';

// Lower-case alphanumeric, 21 chars — collision-resistant for any
// realistic deployment without depending on UUID format quirks.
const make = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);

export const newOrgId = (): string => `org_${make()}`;
export const newUserId = (): string => `u_${make()}`;
export const newProjectId = (): string => `p_${make()}`;
export const newEnvironmentId = (): string => `e_${make()}`;
export const newSecretId = (): string => `s_${make()}`;
export const newRefreshTokenId = (): string => `rt_${make()}`;
export const newApprovalId = (): string => `apr_${make()}`;
