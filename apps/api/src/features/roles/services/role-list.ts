/** Start each count at the role index. The normal JOIN plan scans the entire
 * year membership for every role, even when that role has few holders. */
export const roleSelection = `SELECT
         role.id,
         role.position,
         role.name,
         role.color,
         GROUP_CONCAT(permission.permission) AS permissions,
         (SELECT COUNT(*) FROM member_year_roles membership
          CROSS JOIN year_memberships year_membership
            ON year_membership.member_id = membership.member_id
           AND year_membership.year = role.year
           AND year_membership.status = 'active'
          WHERE membership.role_id = role.id) AS memberCount
       FROM year_roles role
       LEFT JOIN year_role_permissions permission ON permission.role_id = role.id
       WHERE role.year = ?
       GROUP BY role.id
       ORDER BY role.position DESC, lower(role.name)`
