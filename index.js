import bodyParser from "body-parser";
import cors from "cors";
import csv from "csv-parser";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import fs from "fs";
import { Telegraf } from "telegraf";
import webpush from "web-push";
import { fetchTrackedUsersData } from "../BOTSQLite/src/database/query.js";
import { updateTrackedUsersMap } from "../BOTSQLite/src/global.js";

dotenv.config();

let dbPromise;
import("../Botsqlite/src/database/connection.js")
  .then((module) => {
    dbPromise = module.default;
  })
  .catch((err) => {
    console.error("Erreur lors du chargement de la base de données:", err);
  });

let dbSubscription;
import("./dbsubscription.js")
  .then((module) => {
    dbSubscription = module.default;
  })
  .catch((err) => {
    console.error("Erreur lors du chargement de la base de données:", err);
  });

let dbUserstats;
import("./dbsubscription2.js")
  .then((module) => {
    dbUserstats = module.default;
  })
  .catch((err) => {
    console.error("Erreur lors du chargement de la base de données:", err);
  });

const app = express();
const port = 3000;

webpush.setVapidDetails(
  "mailto:maximesaltet@gmail.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const csvFilePath = "../BOTSQLite/topUsersData.csv";

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true },
  })
);

app.set("trust proxy", 1);
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(
  cors({
    origin: "https://stakesportbot.xyz/",
    credentials: true,
  })
);

app.post("/api/subscribe", async (req, res) => {
  const { endpoint, expirationTime, keys } = req.body;
  const telegramId = req.session.telegramId;

  try {
    const db = await dbSubscription;
    // Vérifier si l'abonnement existe déjà
    const existingSubscription = await db.get(
      "SELECT id FROM push_subscriptions WHERE endpoint = ?",
      endpoint
    );

    if (!existingSubscription) {
      await db.run(
        "INSERT INTO push_subscriptions (endpoint, expirationTime, p256dh, auth, telegram_id) VALUES (?, ?, ?, ?, ?)",
        [endpoint, expirationTime, keys.p256dh, keys.auth, telegramId]
      );
      res.status(201).json({ message: "Nouvel abonnement reçu et stocké." });
    } else {
      res.status(200).json({ message: "Abonnement déjà existant." });
    }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'abonnement:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de l'enregistrement de l'abonnement." });
  }
});

app.post("/api/authentifier-telegram", async (req, res) => {
  const telegramId = req.body.telegramId;

  const isSubscribed = await checkSubscription(telegramId);
  if (!isSubscribed) {
    return res.status(403).send({
      message: "Veuillez vous abonner au channel VIP",
      subscribeUrl: "https://t.me/OxaPayCHGBot?start=qVWWsGw",
    });
  }

  // Vérification de l'utilisateur dans la base de données
  try {
    const db = await dbPromise;
    const rows = await db.all(
      "SELECT * FROM apikey WHERE telegram_id = ?",
      telegramId
    );

    if (rows.length > 0) {
      req.session.telegramId = telegramId;
      res.send({ message: "Authentification réussie" });
    } else {
      // L'utilisateur doit fournir sa clé API et son nom d'utilisateur Stake
      res.status(401).send({
        message:
          "Veuillez fournir votre clé API et votre nom d'utilisateur Stake",
      });
    }
  } catch (error) {
    console.error("Erreur de connexion à la base de données:", error);
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

async function checkSubscription(telegramId) {
  const bot = new Telegraf("6918396428:AAFEiDgLFHds8SMGexCuH-JtK3GDsPKqT_E"); // Assurez-vous que BOT_TOKEN est défini
  const CHANNEL_ID = -1002091806593;

  try {
    const member = await bot.telegram.getChatMember(CHANNEL_ID, telegramId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch (error) {
    console.error("Erreur lors de la vérification de l'abonnement :", error);
    return false;
  }
}

app.post("/api/enregistrer-utilisateur", async (req, res) => {
  const { telegramId, apiKey, stakeUsername } = req.body;
  req.session.telegramId = telegramId;

  if (!telegramId || !apiKey || !stakeUsername) {
    return res.status(400).send({ message: "Informations manquantes" });
  }

  try {
    const db = await dbPromise;
    const userExists = await db.get(
      "SELECT * FROM apikey WHERE telegram_id = ?",
      telegramId
    );

    if (userExists) {
      return res.status(409).send({ message: "Utilisateur déjà enregistré" });
    }

    await db.run(
      "INSERT INTO apikey (telegram_id, api_key, stake_username) VALUES (?, ?, ?)",
      [telegramId, apiKey, stakeUsername]
    );
    res.send({ message: "Enregistrement réussi" });
  } catch (error) {
    console.error("Erreur de connexion à la base de données:", error);
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.post("/api/logout", function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      console.error("Erreur de déconnexion:", err);
      res
        .status(500)
        .send({ message: "Erreur du serveur lors de la déconnexion" });
    } else {
      res.send({ message: "Déconnexion réussie" });
    }
  });
});

app.get("/api/search-users/:searchTerm", async (req, res) => {
  try {
    const searchTerm = `%${req.params.searchTerm}%`;
    const db = await dbPromise;

    const query = `SELECT user
                   FROM sports_bets 
                   WHERE user LIKE ?
                   GROUP BY user`;
    const searchResults = await db.all(query, searchTerm);

    res.json(searchResults);
  } catch (error) {
    console.error("Error in /api/search-users/:", error);
    res.status(500).send({ message: "Server Error" });
  }
});

app.get("/api/user-stats", async (req, res) => {
  if (!req.session.telegramId) {
    return res.status(401).send({ message: "Non autorisé" });
  }

  try {
    const db = await dbPromise;
    const userRows = await db.all(
      "SELECT stake_username FROM apikey WHERE telegram_id = ?",
      req.session.telegramId
    );

    if (userRows.length > 0) {
      const stake_username = userRows[0].stake_username;
      const stats = await db.all(
        `SELECT 
        user,
        COUNT(*) AS total_bets,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN status IN ('lost', 'cashout') THEN 1 ELSE 0 END) AS losses,
        ROUND(
          IFNULL(
            SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) / 
            NULLIF(SUM(CASE WHEN status IN ('lost', 'cashout') THEN 1 ELSE 0 END), 0),
            SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END)
          ), 2
        ) AS win_loss_ratio,
        ROUND(SUM(CASE WHEN status = 'won' THEN amount * potentialMultiplier ELSE 0 END) - SUM(amount), 2) AS profit,
        AVG(potentialMultiplier) AS avg_potential_multiplier,
        AVG(amount) AS avg_bet_amount,
        ROUND(
          (SUM(CASE WHEN status = 'won' THEN amount * potentialMultiplier ELSE 0 END) - SUM(amount)) / SUM(amount) * 100, 
          2
        ) AS roi 
        FROM sports_bets 
        WHERE user = ? AND status != 'pending' 
        GROUP BY user`,
        [stake_username]
      );
      res.send(stats);
    } else {
      res.status(404).send({ message: "Utilisateur non trouvé" });
    }
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.get("/api/followed-users", async (req, res) => {
  if (!req.session.telegramId) {
    return res.status(401).send({ message: "Non autorisé" });
  }

  try {
    const db = await dbPromise;
    const telegramId = req.session.telegramId;
    const followedUsers = await db.all(
      "SELECT followed_username FROM user_tracking WHERE telegram_id = ?",
      telegramId
    );
    res.send(followedUsers);
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.get("/api/top20-users", async (req, res) => {
  if (!req.session.telegramId) {
    return res.status(401).send({ message: "Non autorisé" });
  }

  const results = [];

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      res.send(results);
    })
    .on("error", (error) => {
      console.error("Erreur:", error);
      res.status(500).send({ message: "Erreur du serveur" });
    });
});

app.get("/api/user-stats/:username", async (req, res) => {
  const username = req.params.username;
  const results = [];

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      const userCsvData = results.find(
        (user) => user.USER.toLowerCase() === username.toLowerCase()
      );

      if (userCsvData) {
        const formattedData = formatCsvDataToStats(userCsvData);
        res.send(formattedData);
      } else {
        try {
          const db = await dbPromise;
          const stats = await db.all(
            `SELECT 
            user,
            COUNT(*) AS total_bets,
            SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN status IN ('lost', 'cashout') THEN 1 ELSE 0 END) AS losses,
            ROUND(
              IFNULL(
                SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) / 
                NULLIF(SUM(CASE WHEN status IN ('lost', 'cashout') THEN 1 ELSE 0 END), 0),
                SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END)
              ), 2
            ) AS win_loss_ratio,
            ROUND(SUM(CASE WHEN status = 'won' THEN amount * potentialMultiplier ELSE 0 END) - SUM(amount), 2) AS profit,
            AVG(potentialMultiplier) AS avg_potential_multiplier,
            AVG(amount) AS avg_bet_amount,
            ROUND(
              (SUM(CASE WHEN status = 'won' THEN amount * potentialMultiplier ELSE 0 END) - SUM(amount)) / SUM(amount) * 100, 
              2
            ) AS roi 
            FROM sports_bets 
            WHERE user = ? AND status != 'pending' 
            GROUP BY user`,
            [username]
          );

          if (stats.length) {
            res.json(stats[0]);
          } else {
            res.status(404).send({
              message:
                "Statistiques non trouvées pour l'utilisateur : " + username,
            });
          }
        } catch (error) {
          console.error(
            "Erreur lors de la récupération des statistiques de l'utilisateur :",
            error
          );
          res.status(500).send({ message: "Erreur du serveur" });
        }
      }
    })
    .on("error", (error) => {
      console.error("Erreur lors de la lecture du fichier CSV:", error);
      res.status(500).send({ message: "Erreur du serveur" });
    });
});

app.get("/api/autobet-settings/:username", async (req, res) => {
  const username = req.params.username;

  try {
    const db = await dbPromise;

    const telegramId = req.session.telegramId;
    const settings = await db.all(
      "SELECT * FROM user_tracking WHERE telegram_id = ? AND followed_username = ?",
      [telegramId, username]
    );

    if (settings.length) {
      res.json({
        bet_amount: settings[0].bet_amount,
        variable_bet: settings[0].variable_bet,
        auto_bet_active: settings[0].auto_bet_active,
        max_bet_amount: settings[0].max_bet_amount,
        currency: settings[0].currency,
      });
    } else {
      res.status(404).send({
        message:
          "Paramètres d'autobet non trouvés pour l'utilisateur : " + username,
      });
    }
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des paramètres d'autobet de l'utilisateur :",
      error
    );
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.delete("/api/unfollow-user/:username", async (req, res) => {
  if (!req.session.telegramId) {
    return res.status(401).send({ message: "Non autorisé" });
  }

  try {
    const db = await dbPromise;

    const telegramId = req.session.telegramId;
    const username = req.params.username;
    await db.run(
      "DELETE FROM user_tracking WHERE followed_username = ? AND telegram_id = ?",
      [username, telegramId]
    );
    await updateTrackedUsersData();
    res.send({ message: "Utilisateur supprimé avec succès" });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.post("/api/update-autobet-settings/:username", async (req, res) => {
  const username = req.params.username;
  const {
    bet_amount,
    variable_bet,
    max_bet_amount,
    currency,
    auto_bet_active,
  } = req.body;

  try {
    const db = await dbPromise;

    const telegramId = req.session.telegramId;
    const updateResponse = await db.run(
      "UPDATE user_tracking SET bet_amount = ?, variable_bet = ?, max_bet_amount = ?, currency = ?, auto_bet_active = ? WHERE telegram_id = ? AND followed_username = ?",
      [
        bet_amount,
        variable_bet,
        max_bet_amount,
        currency,
        auto_bet_active,
        telegramId,
        username,
      ]
    );

    if (updateResponse.changes > 0) {
      await updateTrackedUsersData();
      res.send({
        message:
          "Paramètres d'autobet mis à jour avec succès pour l'utilisateur : " +
          username,
      });
    } else {
      await updateTrackedUsersData();
      res.status(404).send({
        message:
          "Aucune mise à jour effectuée pour l'utilisateur : " + username,
      });
    }
  } catch (error) {
    console.error(
      "Erreur lors de la mise à jour des paramètres d'autobet de l'utilisateur :",
      error
    );
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.post("/api/follow-user/:username", async (req, res) => {
  try {
    const db = await dbPromise;

    const telegramId = req.session.telegramId;
    const username = req.params.username;

    // Vérifiez si l'utilisateur est déjà suivi
    const existingUser = await db.get(
      "SELECT * FROM user_tracking WHERE telegram_id = ? AND followed_username = ?",
      [telegramId, username]
    );

    if (!existingUser) {
      // Si l'utilisateur n'est pas déjà suivi, insérez la nouvelle ligne
      await db.run(
        "INSERT INTO user_tracking (telegram_id, followed_username, bet_amount, variable_bet, auto_bet_active, max_bet_amount, currency) VALUES (?, ?, 1, 0, 0, NULL, 'btc')",
        [telegramId, username]
      );
      await updateTrackedUsersData();
      res.send({ message: "User followed successfully" });
    } else {
      // Si l'utilisateur est déjà suivi, renvoyez un message approprié
      res.send({ message: "User is already being followed" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send({ message: "Server error" });
  }
});

app.get("/api/user-daily-stats/:username", async (req, res) => {
  const username = req.params.username;

  try {
    const db = await dbPromise;
    const dailyStats = await db.all(
      `WITH daily AS (
          SELECT 
            DATE(createdAt) as date,
            SUM(CASE WHEN status = 'won' THEN amount * potentialMultiplier - amount ELSE -amount END) AS daily_profit,
            MAX(amount) as max_bet_amount,
            SUM(amount) as total_bet_amount,
            (SUM(CASE WHEN status = 'won' THEN amount * potentialMultiplier - amount ELSE -amount END) / SUM(amount)) * 100 AS daily_roi
          FROM sports_bets
          WHERE user = ? AND status != 'pending'
          GROUP BY DATE(createdAt), user
        ), cumulative AS (
          SELECT 
            date, 
            SUM(daily_profit) OVER (ORDER BY date) as cumulative_profit,
            SUM(total_bet_amount) OVER (ORDER BY date) as cumulative_bet_amount
          FROM daily
        )
        SELECT 
          daily.date, 
          daily.daily_profit, 
          daily.max_bet_amount, 
          daily.daily_roi, 
          cumulative.cumulative_profit, 
          (cumulative.cumulative_profit / NULLIF(cumulative.cumulative_bet_amount, 0)) * 100 AS cumulative_roi
        FROM daily
        JOIN cumulative ON daily.date = cumulative.date`,
      [username]
    );

    if (dailyStats.length) {
      res.json(dailyStats);
    } else {
      res.status(404).send({
        message:
          "Statistiques quotidiennes non trouvées pour l'utilisateur : " +
          username,
      });
    }
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des statistiques quotidiennes de l'utilisateur :",
      error
    );
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.post("/api/change-api-key", async (req, res) => {
  const { newApiKey } = req.body;
  const telegramId = req.session.telegramId;

  if (!telegramId || !newApiKey) {
    return res.status(400).send({ message: "Informations manquantes" });
  }

  try {
    const db = await dbPromise;
    await db.run("UPDATE apikey SET api_key = ? WHERE telegram_id = ?", [
      newApiKey,
      telegramId,
    ]);
    res.send({ message: "Clé API modifiée avec succès" });
  } catch (error) {
    console.error("Erreur de connexion à la base de données:", error);
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.get("/api/user-stats-table", async (req, res) => {
  if (!req.session.telegramId) {
    return res.status(401).send({ message: "Non autorisé" });
  }

  try {
    const telegramId = req.session.telegramId;
    const db2 = await dbUserstats;

    const userStats = await db2.all(
      `
      SELECT iid, createdAt, followed_user, amount, currency, odds
      FROM betting_records
      WHERE telegram_id = ?`,
      telegramId
    );

    const db = await dbPromise;
    for (let stat of userStats) {
      const statusResult = await db.get(
        `
        SELECT status
        FROM sports_bets
        WHERE iid = ?`,
        stat.iid
      );
      stat.status = statusResult ? statusResult.status : null;
    }

    res.send(userStats);
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.get("/api/user-stats-graph", async (req, res) => {
  try {
    const telegramId = req.session.telegramId;
    const db2 = await dbUserstats;
    const db = await dbPromise;

    const bettingRecords = await db2.all(
      `SELECT 
        DATE(createdAt) as date, 
        iid, 
        amount, 
        odds 
      FROM betting_records 
      WHERE telegram_id = ?`,
      [telegramId]
    );

    for (let record of bettingRecords) {
      const statusResult = await db.get(
        `SELECT status FROM sports_bets WHERE iid = ?`,
        [record.iid]
      );
      record.status = statusResult ? statusResult.status : null;
    }

    const statsByDate = bettingRecords.reduce((acc, record) => {
      acc[record.date] = acc[record.date] || [];
      acc[record.date].push(record);
      return acc;
    }, {});

    let cumulativeProfit = 0;
    let cumulativeBetAmount = 0;

    const dailyStats = Object.keys(statsByDate)
      .map((date) => {
        const records = statsByDate[date].filter(
          (record) => record.status && record.status !== "pending"
        );

        if (records.length === 0) {
          // Si aucun enregistrement valide pour cette date, ne pas inclure dans les stats
          return null;
        }

        const dailyProfit = records.reduce((sum, record) => {
          return (
            sum +
            (record.status === "won"
              ? record.amount * record.odds - record.amount
              : -record.amount)
          );
        }, 0);
        const maxBetAmount = Math.max(
          ...records.map((record) => record.amount)
        );
        const totalBetAmount = records.reduce(
          (sum, record) => sum + record.amount,
          0
        );
        const dailyROI =
          totalBetAmount > 0 ? (dailyProfit / totalBetAmount) * 100 : 0;

        cumulativeProfit += dailyProfit;
        cumulativeBetAmount += totalBetAmount;
        const cumulativeROI =
          cumulativeBetAmount > 0
            ? (cumulativeProfit / cumulativeBetAmount) * 100
            : 0;

        return {
          date,
          dailyProfit,
          maxBetAmount,
          dailyROI,
          cumulativeProfit,
          cumulativeROI,
        };
      })
      .filter((stat) => stat !== null);

    if (dailyStats.length) {
      res.json(dailyStats);
    } else {
      res.status(404).send({ message: "Autobet statistics not found" });
    }
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des statistiques quotidiennes :",
      error
    );
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.delete("/api/delete-all-stats", async (req, res) => {
  if (!req.session.telegramId) {
    return res.status(401).send({ message: "Non autorisé" });
  }

  try {
    const db = await dbPromise;
    const telegramId = req.session.telegramId;

    // Trouver le stake_username correspondant au telegram_id
    const apiKeyResult = await db.get(
      "SELECT stake_username FROM apikey WHERE telegram_id = ?",
      telegramId
    );

    if (apiKeyResult && apiKeyResult.stake_username) {
      // Supprimer les enregistrements dans sports_bets
      await db.run(
        "DELETE FROM sports_bets WHERE user = ?",
        apiKeyResult.stake_username
      );
      res.send({
        message: "Toutes les statistiques ont été supprimées avec succès",
      });
    } else {
      res.status(404).send({ message: "Utilisateur non trouvé" });
    }
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

app.delete("/api/delete-autobet-stats", async (req, res) => {
  if (!req.session.telegramId) {
    return res.status(401).send({ message: "Non autorisé" });
  }

  try {
    const db2 = await dbUserstats;
    const telegramId = req.session.telegramId;

    await db2.run(
      "DELETE FROM betting_records WHERE telegram_id = ?",
      telegramId
    );
    res.send({
      message: "Les statistiques de l'autobet ont été supprimées avec succès",
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).send({ message: "Erreur du serveur" });
  }
});

function formatCsvDataToStats(csvData) {
  return {
    total_bets: csvData.TOTAL_BETS,
    wins: csvData.WINS,
    losses: csvData.LOSSES,
    win_loss_ratio: csvData.RATIO,
    profit: parseFloat(csvData.PROFIT).toFixed(2),
    avg_potential_multiplier: parseFloat(csvData.AVG_MULTI).toFixed(2),
    avg_bet_amount: parseFloat(csvData.AVG_AMOUNT).toFixed(2),
    roi: parseFloat(csvData.ROI).toFixed(2),
  };
}

async function updateTrackedUsersData() {
  const users = await fetchTrackedUsersData();
  updateTrackedUsersMap(users);
}

app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
