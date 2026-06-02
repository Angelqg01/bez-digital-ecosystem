# Dash KPIs para Google Sheets

Usar una pestana `Dash` con estos indicadores:

- `emails_verificados`
- `emails_enviados`
- `bounce_rate`
- `reply_rate`
- `positive_reply_rate`
- `meetings_booked`
- `proposal_rate`
- `win_rate`

Objetivos iniciales razonables:

- `bounce_rate < 2%`
- `reply_rate > 5%`
- `positive_reply_rate > 1.5%`
- `meeting_rate > 1%`

Definiciones operativas:

- `emails_verificados`: leads con `email_verificado=TRUE`
- `emails_enviados`: actividades con `tipo=email_sent`
- `bounce_rate`: `bounce / emails_enviados`
- `reply_rate`: `replies / emails_enviados`
- `positive_reply_rate`: `positive / emails_enviados`
- `meetings_booked`: leads en `meeting_booked`
- `proposal_rate`: `proposal / positive`
- `win_rate`: `won / proposal`

Pestanas recomendadas:

1. `Leads`
2. `Activities`
3. `Replies`
4. `Meetings`
5. `Dash`
