'use strict';
/* Every user-facing string, in one place, shared by the window and the tray
   menu so the two can never drift apart.
   Detection is automatic from the system locale; English is the fallback.
   Adding a language means adding one object below, nothing else. */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.I18N = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  const STRINGS = {
    en: {
      panelTitle: 'Claude Marge',
      session: 'Current session',
      allModels: 'All models',
      modelWeek: (m) => `${m}, this week`,
      used: (p) => `${p}% used`,
      activeBadge: 'active limit',
      resetIn: (t) => `Resets in ${t}`,
      resetAt: (d, t) => `Resets ${d} ${t}`,
      resetNow: 'Resetting now',
      today: 'today',
      hours: (h, m) => (m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`),
      minutes: (m) => `${m} min`,
      stale: (t) => `Last read at ${t}`,
      errors: {
        loading: 'Reading your usage.',
        'no-credentials': 'No Claude session on this machine. Run <b>claude</b> once and sign in.',
        'token-expired': 'The Claude token expired. Open Claude Code once, it renews it on its own.',
        unauthorized: 'The account refused the usage lookup.',
        network: 'Cannot reach api.anthropic.com.',
        'rate-limited': 'Too many requests. Slowing down.',
        server: 'Anthropic answered with an error. Retrying.',
        unknown: 'Unknown state.'
      },
      menu: { refresh: 'Refresh now', peek: 'Show for 3 seconds', open: 'Open configuration',
        reload: 'Reload configuration', quit: 'Quit' }
    },

    fr: {
      panelTitle: 'Claude Marge',
      session: 'Session en cours',
      allModels: 'Tous modèles',
      modelWeek: (m) => `${m}, cette semaine`,
      used: (p) => `${p}% utilisés`,
      activeBadge: 'limite active',
      resetIn: (t) => `Reset dans ${t}`,
      resetAt: (d, t) => `Reset ${d} ${t}`,
      resetNow: 'Reset imminent',
      today: "aujourd'hui",
      hours: (h, m) => (m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`),
      minutes: (m) => `${m} min`,
      stale: (t) => `Dernière lecture à ${t}`,
      errors: {
        loading: 'Lecture de la consommation en cours.',
        'no-credentials': 'Aucune session Claude sur cette machine. Lance <b>claude</b> une fois pour te connecter.',
        'token-expired': 'Le jeton Claude a expiré. Ouvre Claude Code une fois, il le renouvelle tout seul.',
        unauthorized: 'Le compte a refusé la lecture de la consommation.',
        network: 'Connexion à api.anthropic.com impossible.',
        'rate-limited': 'Trop de requêtes. Le widget ralentit.',
        server: 'Anthropic a répondu par une erreur. Nouvel essai.',
        unknown: 'État inconnu.'
      },
      menu: { refresh: 'Rafraîchir maintenant', peek: 'Afficher 3 secondes',
        open: 'Ouvrir la configuration', reload: 'Recharger la configuration', quit: 'Quitter' }
    },

    es: {
      panelTitle: 'Claude Marge',
      session: 'Sesión actual',
      allModels: 'Todos los modelos',
      modelWeek: (m) => `${m}, esta semana`,
      used: (p) => `${p}% usado`,
      activeBadge: 'límite activo',
      resetIn: (t) => `Se reinicia en ${t}`,
      resetAt: (d, t) => `Se reinicia el ${d} a las ${t}`,
      resetNow: 'Reiniciando ahora',
      today: 'hoy',
      hours: (h, m) => (m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`),
      minutes: (m) => `${m} min`,
      stale: (t) => `Última lectura a las ${t}`,
      errors: {
        loading: 'Leyendo tu consumo.',
        'no-credentials': 'No hay sesión de Claude en este equipo. Ejecuta <b>claude</b> una vez e inicia sesión.',
        'token-expired': 'El token de Claude ha caducado. Abre Claude Code una vez, se renueva solo.',
        unauthorized: 'La cuenta rechazó la consulta de consumo.',
        network: 'No se puede contactar con api.anthropic.com.',
        'rate-limited': 'Demasiadas peticiones. Reduciendo el ritmo.',
        server: 'Anthropic respondió con un error. Reintentando.',
        unknown: 'Estado desconocido.'
      },
      menu: { refresh: 'Actualizar ahora', peek: 'Mostrar 3 segundos',
        open: 'Abrir la configuración', reload: 'Recargar la configuración', quit: 'Salir' }
    },

    de: {
      panelTitle: 'Claude Marge',
      session: 'Aktuelle Sitzung',
      allModels: 'Alle Modelle',
      modelWeek: (m) => `${m}, diese Woche`,
      used: (p) => `${p}% verbraucht`,
      activeBadge: 'aktives Limit',
      resetIn: (t) => `Zurücksetzung in ${t}`,
      resetAt: (d, t) => `Zurücksetzung ${d} ${t}`,
      resetNow: 'Wird zurückgesetzt',
      today: 'heute',
      hours: (h, m) => (m ? `${h} Std ${String(m).padStart(2, '0')}` : `${h} Std`),
      minutes: (m) => `${m} Min`,
      stale: (t) => `Zuletzt gelesen um ${t}`,
      errors: {
        loading: 'Verbrauch wird gelesen.',
        'no-credentials': 'Keine Claude-Sitzung auf diesem Rechner. Starte <b>claude</b> einmal und melde dich an.',
        'token-expired': 'Das Claude-Token ist abgelaufen. Öffne Claude Code einmal, es erneuert sich selbst.',
        unauthorized: 'Das Konto hat die Verbrauchsabfrage abgelehnt.',
        network: 'api.anthropic.com ist nicht erreichbar.',
        'rate-limited': 'Zu viele Anfragen. Wird langsamer abgefragt.',
        server: 'Anthropic hat mit einem Fehler geantwortet. Neuer Versuch.',
        unknown: 'Unbekannter Zustand.'
      },
      menu: { refresh: 'Jetzt aktualisieren', peek: '3 Sekunden anzeigen',
        open: 'Konfiguration öffnen', reload: 'Konfiguration neu laden', quit: 'Beenden' }
    },

    it: {
      panelTitle: 'Claude Marge',
      session: 'Sessione corrente',
      allModels: 'Tutti i modelli',
      modelWeek: (m) => `${m}, questa settimana`,
      used: (p) => `${p}% usato`,
      activeBadge: 'limite attivo',
      resetIn: (t) => `Si azzera tra ${t}`,
      resetAt: (d, t) => `Si azzera ${d} alle ${t}`,
      resetNow: 'Azzeramento in corso',
      today: 'oggi',
      hours: (h, m) => (m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`),
      minutes: (m) => `${m} min`,
      stale: (t) => `Ultima lettura alle ${t}`,
      errors: {
        loading: 'Lettura del consumo in corso.',
        'no-credentials': 'Nessuna sessione Claude su questa macchina. Avvia <b>claude</b> una volta e accedi.',
        'token-expired': 'Il token Claude è scaduto. Apri Claude Code una volta, si rinnova da solo.',
        unauthorized: "L'account ha rifiutato la lettura del consumo.",
        network: 'Impossibile raggiungere api.anthropic.com.',
        'rate-limited': 'Troppe richieste. Il widget rallenta.',
        server: 'Anthropic ha risposto con un errore. Nuovo tentativo.',
        unknown: 'Stato sconosciuto.'
      },
      menu: { refresh: 'Aggiorna ora', peek: 'Mostra per 3 secondi',
        open: 'Apri la configurazione', reload: 'Ricarica la configurazione', quit: 'Esci' }
    },

    zh: {
      panelTitle: 'Claude Marge',
      session: '当前会话',
      allModels: '所有模型',
      modelWeek: (m) => `${m}，本周`,
      used: (p) => `已用 ${p}%`,
      activeBadge: '当前上限',
      resetIn: (t) => `${t}后重置`,
      resetAt: (d, t) => `${d} ${t} 重置`,
      resetNow: '正在重置',
      today: '今天',
      hours: (h, m) => (m ? `${h} 小时 ${m} 分` : `${h} 小时`),
      minutes: (m) => `${m} 分钟`,
      stale: (t) => `上次读取 ${t}`,
      errors: {
        loading: '正在读取用量。',
        'no-credentials': '此设备上没有 Claude 会话。请运行一次 <b>claude</b> 并登录。',
        'token-expired': 'Claude 令牌已过期。打开一次 Claude Code，它会自动续期。',
        unauthorized: '账户拒绝了用量查询。',
        network: '无法连接 api.anthropic.com。',
        'rate-limited': '请求过于频繁，正在降低查询频率。',
        server: 'Anthropic 返回了错误，正在重试。',
        unknown: '状态未知。'
      },
      menu: { refresh: '立即刷新', peek: '显示 3 秒', open: '打开配置',
        reload: '重新加载配置', quit: '退出' }
    },

    ja: {
      panelTitle: 'Claude Marge',
      session: '現在のセッション',
      allModels: 'すべてのモデル',
      modelWeek: (m) => `${m}、今週`,
      used: (p) => `${p}% 使用`,
      activeBadge: '有効な上限',
      resetIn: (t) => `${t}後にリセット`,
      resetAt: (d, t) => `${d} ${t} にリセット`,
      resetNow: 'リセット中',
      today: '今日',
      hours: (h, m) => (m ? `${h} 時間 ${m} 分` : `${h} 時間`),
      minutes: (m) => `${m} 分`,
      stale: (t) => `最終取得 ${t}`,
      errors: {
        loading: '使用量を読み込んでいます。',
        'no-credentials': 'このマシンに Claude のセッションがありません。<b>claude</b> を一度実行してサインインしてください。',
        'token-expired': 'Claude のトークンが期限切れです。Claude Code を一度開けば自動で更新されます。',
        unauthorized: 'アカウントが使用量の取得を拒否しました。',
        network: 'api.anthropic.com に接続できません。',
        'rate-limited': 'リクエストが多すぎます。取得間隔を延ばしています。',
        server: 'Anthropic がエラーを返しました。再試行します。',
        unknown: '不明な状態です。'
      },
      menu: { refresh: '今すぐ更新', peek: '3 秒間表示', open: '設定を開く',
        reload: '設定を再読み込み', quit: '終了' }
    }
  };

  /** Pick a language from a BCP 47 tag such as "fr-CA" or "zh-Hans-CN". */
  function pick(locale) {
    const tag = String(locale || 'en').toLowerCase();
    const base = tag.split(/[-_]/)[0];
    return STRINGS[base] || STRINGS.en;
  }

  return { STRINGS, pick, languages: Object.keys(STRINGS) };
}));
