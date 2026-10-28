import { useState } from "react";
import { useSaveData } from "../../state/SaveDataContext";
import { getNotificationBadgeCount, getNotifications } from "../../lib/notifications";

/** UI only — no browser Notification API here yet (see Settings for that, a later phase). */
export function NotificationBell() {
  const { saveData } = useSaveData();
  const [open, setOpen] = useState(false);
  const notifications = getNotifications(saveData);
  const badgeCount = getNotificationBadgeCount(notifications);

  return (
    <div className="notification-bell">
      <button
        type="button"
        className="notification-bell-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="notification-panel"
      >
        <span>Notifications</span>
        {badgeCount > 0 ? (
          <span className="notification-bell-count">{badgeCount}</span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="notification-panel-backdrop"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div id="notification-panel" className="panel notification-panel" role="region" aria-label="Notifications">
            <div className="notification-panel-header">
              <h3 className="dashboard-card-title">Notifications</h3>
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="screen-lede">No notifications right now.</p>
            ) : (
              <ul className="notification-list">
                {notifications.map((notification) => (
                  <li key={notification.id} className={`notification-item notification-item--${notification.tone}`}>
                    {notification.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
