import webpush from "web-push";
import dotenv from "dotenv";

dotenv.config();

webpush.setVapidDetails("mailto:maximesaltet@gmail.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

let dbSubscription;
import("./dbsubscription.js")
  .then((module) => {
    dbSubscription = module.default;
  })
  .catch((err) => {
    console.error("Erreur lors du chargement de la base de données:", err);
  });

export async function sendCustomNotification(telegramId, user, betAmount, betLink) {
  try {
    const db = await dbSubscription;
    const subscriptions = await db.all("SELECT * FROM push_subscriptions WHERE telegram_id = ?", telegramId);

    const payload = JSON.stringify({
      title: `You are following ${user}.`,
      body: `Bet amount: ${betAmount}`,
      data: { url: betLink },
    });

    subscriptions.forEach((subscription) => {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      webpush
        .sendNotification(pushSubscription, payload)
        .then((response) => {
          // Log de succès
          console.log(`Notification send to :`, telegramId);
        })
        .catch((e) => {
          // Log d'erreur
          console.error(`Error sending notification to ${pushSubscription.endpoint}`, e);
        });
    });
  } catch (error) {
    console.error("Error in sendCustomNotification:", error);
  }
}
