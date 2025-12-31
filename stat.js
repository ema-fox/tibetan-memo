function word_stats() {
    let notes = enriched_notes();
    let notes2 = sort_by(note => note.supported_success, notes.map(note => {
        let supports = notes.filter(note2 => note2.uchen.indexOf(note.uchen) >= 0);
        let supported_success = sum(supports.map(note => scale_sucess(note.success))) / supports.length;
        return {...note, bla: supports.length, supported_success};
    }).filter(note => note.bla > 4));
    let learned = notes2.filter(note => note.supported_success >= scale_sucess(10));
    let to_learn = notes2.filter(note => note.supported_success < scale_sucess(10)).toReversed();

    let learned_el = document.createElement('div');
    let learned_title = document.createElement('h2');
    learned_title.innerText = `Learned (${learned.length})`;
    learned_el.append(learned_title);

    learned.forEach(note => {
        let el = document.createElement('div');
        el.innerText = note.english;
        learned_el.append(el);
    });
    document.body.append(learned_el);

    let to_learn_el = document.createElement('div');
    let to_learn_title = document.createElement('h2');
    to_learn_title.innerText = `To learn (${to_learn.length})`;
    to_learn_el.append(to_learn_title);

    to_learn.forEach(note => {
        let progress = document.createElement('progress');
        progress.value = note.supported_success;
        progress.max = scale_sucess(10);
        let el = document.createElement('div');
        let span = document.createElement('span');
        el.style.display = 'flex';
        el.style.gap = '1ch';
        span.innerText = note.english;
        el.append(progress, span);
        to_learn_el.append(el);
    });
    document.body.append(to_learn_el);

    console.log(notes2.length, learned, to_learn);
}

addEventListener('DOMContentLoaded', async () => {
    notes = await (await fetch(deck_prefix + 'cards.json')).json();
    word_stats();
});

