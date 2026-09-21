export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  database: {
    path: process.env.DB_PATH ?? 'attendx.sqlite',
  },
  attendance: {
    qrRotationSeconds: parseInt(process.env.QR_ROTATION_SECONDS ?? '8', 10),
    qrValidWindows: parseInt(process.env.QR_VALID_WINDOWS ?? '2', 10),
    bleProximityRssiThreshold: parseInt(
      process.env.BLE_PROXIMITY_RSSI_THRESHOLD ?? '-70',
      10,
    ),
    defaultAttendanceThreshold: parseInt(
      process.env.DEFAULT_ATTENDANCE_THRESHOLD ?? '75',
      10,
    ),
  },
});
