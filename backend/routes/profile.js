
const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        // Проверяем, вошёл ли пользователь
        if (!req.session.user) {
            return res.status(401).json({
                message: 'Необходимо войти в систему'
            });
        }

        // Получаем аккаунт и связанного клиента
        const userResult = await pool.query(
            `SELECT
                u.id,
                u.login,
                r.name AS role,
                u.client_id,
                c.first_name,
                c.last_name,
                c.middle_name,
                c.phone,
                c.email
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN clients c ON c.id = u.client_id
             WHERE u.id = $1`,
            [req.session.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                message: 'Пользователь не найден'
            });
        }

        const user = userResult.rows[0];

        // Пока у аккаунта нет привязанного клиента
        if (!user.client_id) {
            return res.json({
                user: {
                    id: user.id,
                    login: user.login,
                    role: user.role
                },
                client: null,
                memberships: [],
                visits: [],
                payments: []
            });
        }

        const clientId = user.client_id;

        // Абонементы клиента
        const membershipsResult = await pool.query(
            `SELECT
                m.id,
                mt.name AS membership_name,
                m.start_date,
                m.end_date,
                m.status,
                m.price_at_purchase
             FROM memberships m
             JOIN membership_types mt ON mt.id = m.membership_type_id
             WHERE m.client_id = $1
             ORDER BY m.end_date DESC`,
            [clientId]
        );

        // Последние 10 посещений
        const visitsResult = await pool.query(
            `SELECT
                v.id,
                v.visit_time,
                v.exit_time,
                mt.name AS membership_name
             FROM visits v
             JOIN memberships m ON m.id = v.membership_id
             JOIN membership_types mt ON mt.id = m.membership_type_id
             WHERE v.client_id = $1
             ORDER BY v.visit_time DESC
             LIMIT 10`,
            [clientId]
        );

        // Последние 10 платежей
        const paymentsResult = await pool.query(
            `SELECT
                p.id,
                p.amount,
                p.payment_date,
                p.payment_method,
                p.status,
                mt.name AS membership_name
             FROM payments p
             JOIN memberships m ON m.id = p.membership_id
             JOIN membership_types mt ON mt.id = m.membership_type_id
             WHERE m.client_id = $1
             ORDER BY p.payment_date DESC
             LIMIT 10`,
            [clientId]
        );

        res.json({
            user: {
                id: user.id,
                login: user.login,
                role: user.role
            },
            client: {
                first_name: user.first_name,
                last_name: user.last_name,
                middle_name: user.middle_name,
                phone: user.phone,
                email: user.email
            },
            memberships: membershipsResult.rows,
            visits: visitsResult.rows,
            payments: paymentsResult.rows
        });
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);

        res.status(500).json({
            message: 'Не удалось загрузить профиль'
        });
    }
});

module.exports = router;
