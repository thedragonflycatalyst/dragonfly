package expo.modules.restnotification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The workout rest timer in the notification shade (owner 2026-11-13: "the timer should show up in here when it's
 * going and stay there showing when it's finished in case you missed it").
 * show(): a silent, ongoing notification with a live countdown (the system's chronometer, so it keeps ticking with
 * the app in the background and keeps counting past zero). finished(): replaces it with a "back to work" notice that
 * stays until dismissed. clear(): removes it. The sound at the end comes from the scheduled alert in JS.
 */
class RestNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No context")

  override fun definition() = ModuleDefinition {
    Name("RestNotification")

    Function("show") { untilMs: Double, title: String, body: String ->
      post(live = true, untilMs = untilMs.toLong(), title = title, body = body)
    }
    Function("finished") { title: String, body: String ->
      post(live = false, untilMs = System.currentTimeMillis(), title = title, body = body)
    }
    Function("clear") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
  }

  private fun channel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    // Silent: it only shows the countdown. It never makes a sound, so it never interrupts or lowers music.
    val ch = NotificationChannel(CHANNEL_ID, "Rest countdown", NotificationManager.IMPORTANCE_LOW)
    ch.description = "Shows the rest timer while you're out of the app"
    ch.setSound(null, null)
    ch.enableVibration(false)
    ch.setShowBadge(false)
    manager.createNotificationChannel(ch)
  }

  private fun post(live: Boolean, untilMs: Long, title: String, body: String) {
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
    channel()
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val tap = launch?.let {
      PendingIntent.getActivity(context, NOTIFICATION_ID, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val iconRes = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      .takeIf { it != 0 } ?: context.applicationInfo.icon
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(iconRes)
      .setContentTitle(title)
      .setContentText(body)
      .setContentIntent(tap)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setWhen(untilMs)
      .setShowWhen(true)
      .setOngoing(live)
      .setAutoCancel(!live)
    if (live) {
      builder.setUsesChronometer(true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) builder.setChronometerCountDown(true)
    }
    try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
    } catch (e: SecurityException) {
      // Notifications permission not granted: the in-app timer still works
    }
  }

  companion object {
    private const val CHANNEL_ID = "rest-live"
    private const val NOTIFICATION_ID = 7101
  }
}
