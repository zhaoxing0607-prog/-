(() => {
  let members = [];
  let messages = [];
  let mailboxError = '';
  let mailboxActive = false;
  const escape = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const me = () => window.MoldCloud?.getUserId();
  const date = value => value ? new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '';

  window.mailboxPage = () => {
    const userId = me();
    const unread = messages.filter(message => message.recipient_id === userId && !message.read_at).length;
    const recipientOptions = members.filter(member => member.user_id !== userId).map(member => `<option value="${member.user_id}" data-name="${escape(member.display_name || member.email)}">${escape(member.display_name || member.email)}</option>`).join('');
    const rows = messages.map(message => {
      const received = message.recipient_id === userId;
      const person = received ? message.sender_name : message.recipient_name;
      return `<article class="message-row ${received ? 'received' : 'sent'} ${received && !message.read_at ? 'unread' : ''}" data-message-id="${message.id}"><div class="message-avatar">${escape(String(person || '?').slice(0,2).toUpperCase())}</div><div class="message-copy"><div><b>${received ? `De : ${escape(person)}` : `À : ${escape(person)}`}</b><time>${date(message.created_at)}</time></div><p>${escape(message.body)}</p>${received && !message.read_at ? '<span class="message-unread">Nouveau</span>' : ''}</div></article>`;
    }).join('');
    return `<section class="mailbox-layout"><section class="card mailbox-compose"><div class="card-head"><div><span class="section-kicker">NOUVEAU MESSAGE</span><h3>Envoyer une note privée</h3></div><span class="mail-unread-count">${unread} non lu${unread>1?'s':''}</span></div><form id="messageForm"><div class="field"><label>Destinataire</label><select name="recipient" required><option value="">Sélectionner un collègue</option>${recipientOptions}</select></div><div class="field"><label>Message</label><textarea name="body" required maxlength="2000" placeholder="Écrivez votre message…"></textarea></div><div class="message-error" id="messageError">${escape(mailboxError)}</div><button class="primary" type="submit">Envoyer le message</button></form></section><section class="card mailbox-inbox"><div class="card-head"><div><span class="section-kicker">BOÎTE DE RÉCEPTION</span><h3>Mes messages</h3></div><button class="link-btn" data-refresh-messages>Actualiser</button></div><div class="message-list">${rows || '<div class="empty">Aucun message pour le moment.</div>'}</div></section></section>`;
  };

  function showMailbox() {
    mailboxActive = true;
    $('#pageTitle').textContent = 'Messagerie';
    $('#pageDesc').textContent = 'Échangez en privé avec les collaborateurs';
    $('#mainAddBtn').hidden = true;
    content.innerHTML = window.mailboxPage();
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === 'messages'));
    applyRoleUi();
    $('#mainAddBtn').hidden = true;
  }

  document.querySelector('#nav').addEventListener('click', event => {
    const item = event.target.closest('[data-view]');
    if (!item) return;
    if (item.dataset.view !== 'messages') {
      mailboxActive = false;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    showMailbox();
    refreshMailbox();
  }, true);

  async function refreshMailbox() {
    if (!window.MoldCloud?.getUserId()) return;
    try {
      const [nextMembers, nextMessages] = await Promise.all([window.MoldCloud.listActiveMembers(), window.MoldCloud.listMessages()]);
      members = nextMembers || [];
      messages = nextMessages || [];
      mailboxError = '';
    } catch (error) {
      mailboxError = error.message || 'Impossible de charger la messagerie.';
    }
    if (mailboxActive) showMailbox();
  }

  content.addEventListener('click', async event => {
    if (event.target.closest('[data-refresh-messages]')) {
      await refreshMailbox();
      return;
    }
    const row = event.target.closest('.message-row.unread');
    if (!row) return;
    try {
      await window.MoldCloud.markMessageRead(row.dataset.messageId);
      await refreshMailbox();
    } catch (error) {
      toast(error.message || 'Impossible de marquer le message comme lu');
    }
  });

  content.addEventListener('submit', async event => {
    if (event.target.id !== 'messageForm') return;
    event.preventDefault();
    const form = event.target;
    const select = form.elements.recipient;
    const recipient = members.find(member => member.user_id === select.value);
    const body = form.elements.body.value.trim();
    if (!recipient || !body) return;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = 'Envoi…';
    try {
      await window.MoldCloud.sendMessage({ recipientId: recipient.user_id, recipientName: recipient.display_name || recipient.email, body });
      form.reset();
      await refreshMailbox();
      toast('Message envoyé');
    } catch (error) {
      mailboxError = error.message || 'Impossible d’envoyer le message.';
      render();
    } finally {
      button.disabled = false;
      button.textContent = 'Envoyer le message';
    }
  });

  window.addEventListener('toolmanager-role-ready', refreshMailbox);
  window.addEventListener('moldflow-cloud-ready', refreshMailbox);
  setInterval(() => { if (mailboxActive && !document.hidden) refreshMailbox(); }, 30000);
})();
