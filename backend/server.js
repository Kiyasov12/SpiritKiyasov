const express = require('express');
const pool = require('./db');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    store: new PgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8
    }
}));

const authRoutes = require('./routes/auth');

app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});

