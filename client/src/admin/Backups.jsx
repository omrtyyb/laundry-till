// Admin "Backups": every saved copy of the database, a button to make one now, and for each
// backup Download, Restore and Delete. Backups on a plugged-in USB drive are listed too, with
// Restore (e.g. to set the till up again on a new computer). Below the list: the USB stick or external drive that gets a
// second copy of every backup whenever it's plugged in, and the background job that backs up every
// night even when the till isn't open.
// Automatic backups are made when the server starts and every night (see server/lib/backups.js);
// manual ones are made here and are never deleted automatically. A restore first saves the data
// as it is now as a "before restore" backup, so it can be undone (server/lib/restore.js).

import { useEffect, useState } from "react";
import { showToast } from "../utils/toast.js";

const sizeText = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const freeText = (bytes) =>
  bytes == null ? "" : bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB free` : `${Math.round(bytes / 1024 ** 2)} MB free`;

const whenText = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// "/Volumes/SHOP USB" → "SHOP USB", "E:\\" → "E:"
const driveName = (drive) => drive.split(/[\\/]/).filter(Boolean).pop() || drive;

// Why a drive is read-only and what to do about it
const READ_ONLY_HELP =
  "It's most likely formatted for Windows (NTFS), which a Mac can't write to. Use a different " +
  "USB stick, or reformat this one as ExFAT in Disk Utility (that erases everything on it), and it " +
  "will then work on both Mac and Windows.";

const KIND_TEXT = {
  automatic: "Automatic",
  manual: "Made by admin",
  "before-restore": "Saved before a restore",
};

// Sends a request and returns the JSON answer, or throws an Error with the server's message
async function send(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The till server is not answering");
  return result;
}

export default function Backups() {
  // { backups, copy, drives, backgroundJob } from GET /api/admin/backups
  const [data, setData] = useState(null);
  // While a backup is being made: { progress: 0 to 1, stage: "Copying" }; null otherwise
  const [running, setRunning] = useState(null);
  // What is being done right now ("restore", "delete:<name>", "drive", "job", "copy"), so its button waits
  const [busy, setBusy] = useState(null);
  const [chosenDrive, setChosenDrive] = useState("");

  const load = () =>
    fetch("/api/admin/backups")
      .then((response) => response.json())
      .then(setData);

  useEffect(() => {
    load();
    // Notice a USB stick being plugged in or taken out while the page is open
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const act = async (what, work, message) => {
    setBusy(what);
    try {
      const result = await work();
      if (result?.backups) setData(result);
      else await load();
      if (message) showToast(typeof message === "function" ? message(result) : message);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  // The server answers a line at a time ({"progress":0.4,"stage":"Copying"} ... {"done":true}),
  // so the bar moves as the copy is made
  const backUpNow = async () => {
    setRunning({ progress: 0, stage: "Starting" });
    const started = Date.now();
    try {
      const response = await fetch("/api/admin/backups", { method: "POST" });
      if (!response.ok) throw new Error((await response.json()).error);
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines.filter(Boolean)) {
          const message = JSON.parse(line);
          if (message.error) throw new Error(message.error);
          if (message.done) finished = message;
          else setRunning({ progress: message.progress, stage: message.stage });
        }
      }
      if (!finished) throw new Error("The till server stopped before the backup finished");
      setRunning({ progress: 1, stage: "Backup saved" });
      // A small database is copied in a blink: keep the full bar on screen long enough to see
      await new Promise((resolve) => setTimeout(resolve, Math.max(800, 1500 - (Date.now() - started))));
      showToast("Backup saved");
      load();
    } catch (e) {
      showToast(e.message || "The till server is not answering", "error");
    } finally {
      setRunning(null);
    }
  };

  // backup.drive is set for a backup on the USB drive
  const restore = (backup) => {
    const when = whenText(backup.savedAt);
    const from = backup.drive ? ` (from the backup on ${backup.driveName})` : "";
    if (
      !window.confirm(
        `Put the till's data back to how it was on ${when}${from}?\n\n` +
          `Everything entered since then will be gone from the till. ` +
          `A copy of the data as it is now is saved first, so you can undo this by restoring that copy.\n\n` +
          `The admin password, printer and USB settings stay as they are. Staff will need to sign in again on the till.`,
      )
    )
      return;
    act(
      "restore",
      () =>
        backup.drive
          ? send("/api/admin/backups/restore-from-drive", "POST", { drive: backup.drive, name: backup.name })
          : send(`/api/admin/backups/${encodeURIComponent(backup.name)}/restore`, "POST"),
      () => `Data restored to ${when}. Refresh the till screen so it shows the restored data.`,
    );
  };

  const remove = (backup) => {
    if (!window.confirm(`Delete the backup from ${whenText(backup.savedAt)}? This can't be undone.`)) return;
    act(`delete:${backup.name}`, () => send(`/api/admin/backups/${encodeURIComponent(backup.name)}`, "DELETE"), "Backup deleted");
  };

  if (data === null) return <p>Loading…</p>;
  const { backups, copy, drives, onDrives, backgroundJob } = data;
  const working = busy !== null || running !== null;
  const writableDrives = drives.filter((drive) => !drive.readOnly);
  const readOnlyDrives = drives.filter((drive) => drive.readOnly);

  return (
    <section className="report">
      <h2>Backups</h2>
      <p className="report-note">
        A full copy of the till's data is saved on this computer when the till starts and every
        night. Make one yourself any time, for example before a big change.
      </p>
      <div className="form-actions">
        <button onClick={backUpNow} disabled={working}>
          {running ? "Backing up…" : "Back up now"}
        </button>
      </div>
      {running && (
        <div className="backup-progress">
          <div
            className="backup-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(running.progress * 100)}
          >
            <div className="backup-progress-fill" style={{ width: `${running.progress * 100}%` }} />
          </div>
          <p className="report-note">
            {running.stage} · {Math.round(running.progress * 100)}%
          </p>
        </div>
      )}
      {busy === "restore" && <p className="report-note">Restoring… please wait.</p>}

      {backups.length === 0 ? (
        <p>No backups yet.</p>
      ) : (
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Saved</th>
                <th>Type</th>
                <th>Size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.name}>
                  <td>{whenText(backup.savedAt)}</td>
                  <td>{KIND_TEXT[backup.kind]}</td>
                  <td>{sizeText(backup.size)}</td>
                  <td>
                    <div className="backup-actions">
                      <a href={`/api/admin/backups/${encodeURIComponent(backup.name)}/download`} download>
                        Download
                      </a>
                      <button className="sort-button" onClick={() => restore(backup)} disabled={working}>
                        Restore
                      </button>
                      <button
                        className="sort-button danger-button"
                        onClick={() => remove(backup)}
                        disabled={working}
                      >
                        {busy === `delete:${backup.name}` ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="report-note">
        Backups are kept in the <code>server/data/backups</code> folder. Automatic ones are kept
        for 30 days, plus one a month for a year. Ones made here, and the copies saved before a
        restore, are kept until you delete them.
      </p>

      <h3>Second copy on a USB stick or external drive</h3>
      {copy.drive ? (
        <>
          <p>
            Every backup is also copied to <strong>{driveName(copy.drive)}</strong>, into the folder{" "}
            <em>Laundry till backups</em>, whenever it's plugged in.
          </p>
          <p className={copy.lastError ? "backup-status backup-status-bad" : "backup-status"}>
            {copy.readOnly
              ? `It's plugged in but this computer can only read it, not write to it. ${READ_ONLY_HELP}`
              : !copy.pluggedIn
              ? "Not plugged in right now. The copies will be made as soon as it is."
              : copy.lastError
                ? `The last copy failed: ${copy.lastError}`
                : `Plugged in. ${copy.onDrive} backup${copy.onDrive === 1 ? "" : "s"} on it.`}
            {copy.lastCopyAt && ` Last copied ${whenText(copy.lastCopyAt)}.`}
          </p>
          <div className="form-actions">
            <button
              className="sort-button"
              onClick={() => act("copy", () => send("/api/admin/backups/copy-now", "POST"), "Copies are up to date")}
              disabled={working || !copy.pluggedIn}
            >
              {busy === "copy" ? "Copying…" : "Copy now"}
            </button>
            <button
              className="sort-button"
              onClick={() => {
                if (window.confirm(`Stop copying backups to ${driveName(copy.drive)}? The copies already on it stay there.`))
                  act("drive", () => send("/api/admin/backups/copy-drive", "PUT", { drive: null }), "Copies to the drive stopped");
              }}
              disabled={working}
            >
              Stop copying
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="report-note">
            Plug in a USB stick or external drive and pick it here. From then on a copy of every
            backup goes onto it whenever it's plugged in, so the data is safe even if this computer
            breaks or is stolen. Keep it somewhere other than the shop now and then.
          </p>
          {readOnlyDrives.map((drive) => (
            <p key={drive.path} className="backup-status backup-status-bad">
              <strong>{drive.name}</strong> is plugged in, but this computer can only read it, not
              write to it, so backups can't be copied onto it. {READ_ONLY_HELP}
            </p>
          ))}
          {writableDrives.length === 0 ? (
            readOnlyDrives.length === 0 && (
              <p className="backup-status">No USB stick or external drive is plugged in.</p>
            )
          ) : (
            <div className="form-actions">
              <select value={chosenDrive} onChange={(e) => setChosenDrive(e.target.value)}>
                <option value="">Choose a drive…</option>
                {writableDrives.map((drive) => (
                  <option key={drive.path} value={drive.path}>
                    {drive.name} {freeText(drive.free) && `(${freeText(drive.free)})`}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  act(
                    "drive",
                    () => send("/api/admin/backups/copy-drive", "PUT", { drive: chosenDrive }),
                    "Backups are being copied to the drive",
                  )
                }
                disabled={working || !chosenDrive}
              >
                {busy === "drive" ? "Copying…" : "Copy backups to this drive"}
              </button>
            </div>
          )}
        </>
      )}

      <h3>Restore from a USB stick or external drive</h3>
      {onDrives.length === 0 ? (
        <p className="report-note">
          Plug in a drive with till backups on it (in its <em>Laundry till backups</em> folder) and
          they'll be listed here, for example to set the till up again on a new computer.
        </p>
      ) : (
        <>
          <p className="report-note">
            These backups are on the drive. Restoring one puts the till's data back to how it was
            then; the data as it is now is saved first, so it can be undone.
          </p>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Saved</th>
                  <th>Type</th>
                  <th>Drive</th>
                  <th>Size</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {onDrives.map((backup) => (
                  <tr key={backup.drive + backup.name}>
                    <td>{whenText(backup.savedAt)}</td>
                    <td>{KIND_TEXT[backup.kind]}</td>
                    <td>{backup.driveName}</td>
                    <td>{sizeText(backup.size)}</td>
                    <td>
                      <button className="sort-button" onClick={() => restore(backup)} disabled={working}>
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>Back up even when the till is closed</h3>
      {!backgroundJob.supported ? (
        <p className="report-note">This isn't available on this kind of computer.</p>
      ) : (
        <>
          <p className="report-note">
            {backgroundJob.on
              ? `On. This computer makes a backup every night at ${backgroundJob.time}, even when the till isn't open, and copies it to the USB stick if it's plugged in. If the computer was off at that time, it's done as soon as it can be.`
              : `Off. Backups are only made while the till is running. Turn this on and the computer makes one every night at ${backgroundJob.time}, even when the till isn't open.`}
          </p>
          {backgroundJob.lastRun && <p className="backup-status">Last run: {backgroundJob.lastRun}</p>}
          <div className="form-actions">
            <button
              className={backgroundJob.on ? "sort-button" : undefined}
              onClick={() =>
                act(
                  "job",
                  () => send("/api/admin/backups/background-job", "PUT", { on: !backgroundJob.on }),
                  backgroundJob.on ? "Night-time backups turned off" : "Night-time backups turned on",
                )
              }
              disabled={working}
            >
              {busy === "job" ? "Please wait…" : backgroundJob.on ? "Turn off" : "Turn on"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
