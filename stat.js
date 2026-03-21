function progress_list(list_el, notes) {
    notes.toReversed().forEach(note => {
        let progress = document.createElement('div');
        progress.classList.add('progress');
        let bar1 = document.createElement('div');
        let bar2 = document.createElement('div');
        bar1.style.width = `${100 * note.score / token_known_cutoff()}%`;
        //bar1.style.width = `${100 * (note.supported_success - note.improved_today) / scale_sucess(10)}%`;
        //bar2.style.width = `${100 * note.improved_today / scale_sucess(10)}%`;
        progress.append(bar1, bar2);
        let el = document.createElement('div');
        let span = document.createElement('span');
        el.style.display = 'flex';
        el.style.gap = '1ch';
        span.innerText = note.english;
        el.append(progress, span);
        list_el.append(el);
    });
}

function word_stats() {
    let notes = enriched_notes();

    let notes2 = sort_by(note => note.score, notes.filter(note => notes.filter(note2 => note2.uchen.indexOf(note.uchen) >= 0).length > 4));

    let {learned = [], learning = [], to_learn = []} = Object.groupBy(notes2, note => {
        if (note.score > token_known_cutoff()) {
            console.log(Object.keys(note.tokens), Object.keys(note.tokens).map(token_score));
            return 'learned';
        } else if (note.score > 0.2) {
            return 'learning';
        } else {
            return 'to_learn';
        }
    });

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

    let learning_el = document.createElement('div');
    let learning_title = document.createElement('h2');
    learning_title.innerText = `Learning (${learning.length})`;
    learning_el.append(learning_title);

    progress_list(learning_el, learning);
    document.body.append(learning_el);

    let to_learn_el = document.createElement('div');
    let to_learn_title = document.createElement('h2');
    to_learn_title.innerText = `To learn (${to_learn.length})`;
    to_learn_el.append(to_learn_title);

    progress_list(to_learn_el, to_learn);
    document.body.append(to_learn_el);
}

addEventListener('DOMContentLoaded', async () => {
    await load_notes();
    word_stats();
});

