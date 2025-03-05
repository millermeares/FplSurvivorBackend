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
