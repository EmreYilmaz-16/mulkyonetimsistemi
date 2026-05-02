INSERT INTO users (organization_id, name, email, password, role)
SELECT
  o.id,
  'Super Admin',
  'superadmin@kiratakip.local',
  '$2a$12$WeisLWdrs0sp8vnp3dHz8.anJwp4Hd.SJuhvGvmPQZTG6dw9z.ZJ2',
  'platform_admin'
FROM organizations o
WHERE o.slug = 'varsayilan-organizasyon'
  AND NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.email = 'superadmin@kiratakip.local'
  );