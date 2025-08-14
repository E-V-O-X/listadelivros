// /api/health.js
module.exports = (req, res) => {
  const hasKey = !!process.env.GOOGLE_BOOKS_KEY;
  res.status(200).json({ ok: true, hasKey });
};
