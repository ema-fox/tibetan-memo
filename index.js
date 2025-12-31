
addEventListener('DOMContentLoaded', async () => {
    notes = await (await fetch(deck_prefix + 'cards.json')).json();
    show_notes();
});

