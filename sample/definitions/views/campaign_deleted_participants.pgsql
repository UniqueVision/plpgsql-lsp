DROP VIEW IF EXISTS campaign.deleted_participants CASCADE;

CREATE VIEW campaign.deleted_participants AS
SELECT
  *
FROM
  campaign.participants
WHERE
  deleted_at <> NULL;
