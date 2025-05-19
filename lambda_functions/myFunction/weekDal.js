const SEASON_NUMBER = 48

/**
 * Fetches a week entry from the survivor.week table by primary key.
 * @param {Client} client - The PostgreSQL client instance.
 * @returns {Promise<Object|null>} The week row or null if not found.
 */
export async function getWeek(client, weekId) {
    const query = `
        SELECT season, episode_number, lock_time
        FROM survivor.week
        WHERE season = $1 AND episode_number = $2;
    `;

    try {
        const res = await client.query(query, [SEASON_NUMBER, weekId]);
        if (res.rows.length == 0) {
          throw new Error("No weeks found")
        }
        return res.rows[0]
    } catch (error) {
        console.error('Error fetching week:', error);
        throw error;
    }
}

/**
 * Returns the current Survivor week based on the current time.
 * Prioritizes currently airing episode, then upcoming, then latest past.
 */
export async function getCurrentWeek(client) {
    const query = `
        WITH ranked_weeks AS (
            SELECT *,
                CASE
                    WHEN lock_time <= now() AND now() < lock_time + interval '2 hours' THEN 1 -- currently airing
                    WHEN lock_time > now() THEN 2 -- next future episode
                    ELSE 3 -- past episode
                END AS rank
            FROM survivor.week
        )
        SELECT season, episode_number, lock_time
        FROM ranked_weeks
        ORDER BY rank, lock_time
        LIMIT 1;
    `;

    try {
        const res = await client.query(query);
        if (res.rows.length === 0) {
            throw new Error("No weeks found");
        }
        return res.rows[0];
    } catch (error) {
        console.error('Error fetching current week:', error);
        throw error;
    }
}


export async function argWeekOrCurrent(client, args) {
  const parsed = JSON.parse(args)
  if (parsed.week) {
    return parsed.week
  } 
  const currentWeek = await getCurrentWeek(client)
  return currentWeek.episode_number
}
