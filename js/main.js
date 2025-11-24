// main.js — small extras for UX

document.addEventListener('DOMContentLoaded', () => {
    // highlight the card if coming from a subject
    try {
      const from = sessionStorage.getItem('fromSubject');
      if (from){
        const el = document.querySelector(`.card[href^="${from}/"]`);
        if (el) el.style.outline = '3px solid rgba(125,211,252,0.14)';
      }
    } catch(e){ /* ignore */ }
  
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => {
        const href = card.getAttribute('href');
        const subject = href.split('/')[0];
        try { sessionStorage.setItem('fromSubject', subject); } catch(e) {}
      });
    });
  });
  