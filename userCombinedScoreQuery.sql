WITH RankedUsers AS (
    SELECT user,
        COUNT(*) AS total_bets,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN status IN ('lost', 'cashout') THEN 1 ELSE 0 END) AS losses,
        ROUND(
            IF(SUM(CASE WHEN status IN ('lost', 'cashout') THEN 1 ELSE 0 END) = 0, 
                SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END),
                (SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) / 
                SUM(CASE WHEN status IN ('lost', 'cashout') THEN 1 ELSE 0 END))), 2) AS win_loss_ratio,
        ROUND(SUM(CASE WHEN status = 'won' THEN amount * potentialMultiplier ELSE 0 END) - SUM(amount), 2) AS profit,
        AVG(potentialMultiplier) AS avg_potential_multiplier,
        AVG(amount) AS avg_bet_amount,
        ROUND(((SUM(CASE WHEN status = 'won' THEN amount * potentialMultiplier ELSE 0 END) - SUM(amount)) / SUM(amount)) * 100, 2) AS roi,
        DATEDIFF(MAX(createdAt), MIN(createdAt)) + 1 AS betting_days,
        ROUND((COUNT(*) / (DATEDIFF(MAX(createdAt), MIN(createdAt)) + 1)), 2) AS avg_bets_per_day
    FROM sports_bets
    WHERE status != 'pending'
    GROUP BY user
    HAVING total_bets >= 150 AND win_loss_ratio >= 1.4 AND total_bets = wins + losses AND profit > 0 AND avg_potential_multiplier > 1.2 AND roi <= 100 AND avg_bet_amount > 0.01 AND roi >= 5
), MaxValues AS (
    SELECT MAX(profit) as max_profit, 
            MAX(total_bets) as max_total_bets, 
            MAX(win_loss_ratio) as max_win_loss_ratio,
            MAX(roi) as max_roi
    FROM RankedUsers
)

SELECT user, total_bets, wins, losses, win_loss_ratio, profit, roi, avg_potential_multiplier, avg_bet_amount, avg_bets_per_day,
        (profit / max_profit * 0.25 + 
        total_bets / max_total_bets * 0.35 + roi / max_roi * 0.4) AS combined_score
FROM RankedUsers, MaxValues
ORDER BY combined_score DESC
LIMIT 20
