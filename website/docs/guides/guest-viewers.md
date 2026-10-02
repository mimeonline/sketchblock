# Guest Viewers

Allow anyone to view your live board without signing in. Guests see the board in read-only mode and are identified in the participant list by their chosen display name.

## Enabling Guest Access

In the **Share** dialog, toggle **Allow viewing without an account** in the Viewers section. This generates or renews a public viewer link. Disabled by default.

## Joining as a Guest

Open the viewer link and enter a display name (1–40 characters). You can now watch the board live, follow collaborator updates, and see the participant list. Collaborator links still require GitHub sign-in.

## Guest Lifecycle

Guest access ends when:

- The owner toggles **Allow viewing without an account** off
- The owner renews the viewer link
- The owner removes you from participants
- The session ends or expires

Guest names are not verified and not persisted after the session ends.

## Availability

Guest viewers work for both repository sessions and ad-hoc rooms. Requires database migration V14.
