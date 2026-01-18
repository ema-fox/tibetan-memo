function rand(a) {
    return Math.floor(Math.random() * a);
}

function rand_choice(xs) {
    return xs[rand(xs.length)];
}

function mod(a, b) {
    return (a % b + b) % b;
}

function shuffle(xs) {
    for (let i = 0; i < xs.length; i++) {
        let tmp = xs[i];
        let j = i + rand(xs.length - i);
        xs[i] = xs[j];
        xs[j] = tmp;
    }
}

function sort_by(f, xs) {
    return xs.toSorted((a, b) => f(a) - f(b));
}

function now() {
    return (new Date()).getTime();
}

function render_date(d) {
    return d.toISOString().split('T')[0];
}

function today() {
    return render_date(new Date());
}

let state = {
    n_cards: 1,
    difficulty_factor: 2,
    try_counters: {},
    successes: {},
    encounters: {},
    card_exclusions: {},
    hide_counters: {},
    word_stats: {},

    ...JSON.parse(localStorage.getItem('tibetan-memo-state'), "")};

let deck_prefix = "https://ema-fox.github.io/tibetan-deck/";

let notes = [];

function save() {
    localStorage.setItem('tibetan-memo-state', JSON.stringify(state));
}

function sum(xs) {
    return xs.reduce((a, b) => a + b, 0);
}

function scale_sucess(x) {
    return Math.log2(Math.max(1, x + 1)) * 10;
}

function get_all_success() {
    return sum(Object.values(state.successes).map(scale_sucess)) | 0;
}

function avg_success() {
    return get_all_success() / Object.values(state.successes).length | 0;
}


function enriched_notes() {
    return notes.map(note => {
        let id = 'card_' + note.sound;
        let success = (state.successes[id] || 0);
        let failure = sum(Object.values(state.card_exclusions[id] || {}));
        let encounter = (state.encounters[id] || 0);
        return {id, success, encounter, failure,
                tokens: get_tokens(note),
                ...note};
    });
}

function get_tokens(note) {
    let tokens = note.uchen.split(/[་། ]+/).filter(s => s.length);
    return tokens.concat(tokens.slice(0, -1).map((a, i) => `${a} ${tokens[i + 1]}`));
}

function get_token_weights() {
    let counts = {};
    let res = {};
    enriched_notes().forEach(note => {
        let tokens = note.tokens;
        let val = Math.min(note.success, 10) / tokens.length;
        tokens.forEach(token => {
            counts[token] ||= 0.0;
            counts[token] += 1;
            res[token] ||= 0.0;
            res[token] += val;
        });
    });
    Object.keys(res).forEach(token => {
        res[token] /= counts[token];
    });
    return res;
}

function sorted_notes() {
    let weights = get_token_weights();
    console.log(sort_by(x => x[1], Object.entries(weights)));

    let notes2 = enriched_notes().map(note => {
        let tokens = note.tokens;
        let res = 0;
        tokens.forEach(s => {
            res += weights[s] / tokens.length;
        });
        let priority = res / Math.pow(state.difficulty_factor, note.encounter + note.failure);
        return {priority, ...note};
    });

    console.log(sort_by(note => -note.priority, notes2).map(n => n.encounter));
    return sort_by(note => -note.priority, notes2);
}

function get_display_notes() {
    let excluded_notes = {};
    let excluded_tokens = {};

    let res = sorted_notes().filter(note => {
        let id = 'card_' + note.sound;
        let success = (state.successes[id] || 0);
        let prob = 0.5 / Math.pow(2, success / 10);

        let res = !excluded_notes[id];

        if (res) {
            let count = 0;
            note.tokens.forEach(token => {
                count += excluded_tokens[token] || 0;
            });
            if (note.tokens.length < count) {
                res = false;
            }
        }

        if (res) {
            Object.assign(excluded_notes, state.card_exclusions[id])
            note.tokens.forEach(token => {
                excluded_tokens[token] ||= 0;
                excluded_tokens[token]++;
            });
        }

        return res;
    });

    return res.slice(0, state.n_cards);
}

function log_status() {
    let card_goal = scale_sucess(20);

    let n_all_cards = notes.length;

    let success = get_all_success();
    let goal_success = n_all_cards * card_goal;

    let prog_el = document.querySelector('#progress');
    prog_el.max = goal_success;
    prog_el.value = success;

    let all_tries = sum(Object.values(state.try_counters));
    let today_tries = state.try_counters[today()] || 0;

    let speed = success / all_tries;

    let learned_today = today_tries * speed / card_goal | 0;

    let efforts = {...state.try_counters};
    delete efforts[today()];

    efforts = Object.values(efforts);

    efforts.push(10, 20);

    efforts = sort_by(x => x, efforts);


    let target = efforts[Math.ceil(efforts.length * 0.5)];

    console.log("effort:", efforts, target);

    let target_el = document.querySelector('#target');
    target_el.max = target;
    target_el.value = today_tries;

    console.log("success:", success,
                "avg:", avg_success());

    let estimated_required_tries = (goal_success - success) / speed;
    let estimated_total_required_tries = goal_success / speed;

    console.log("all_tries:", all_tries, "etrt:", estimated_total_required_tries | 0);

    let estimated_days = Math.ceil(estimated_required_tries / today_tries);
    let eta = "Unkown";
    if (isFinite(estimated_days)) {
        let estimated_finish = new Date(now() + estimated_days * 24 * 60 * 60 * 1000);
        eta = `In ${estimated_days} days on ${render_date(estimated_finish)}`;
    }

    let stats = [
        ["tableau", state.n_cards],
        ["novelty", (10 * state.difficulty_factor | 0) / 10],
        ["speed", speed | 0],
        ["learned today", learned_today],
        ["ETA", eta]
    ];

    let table = document.querySelector("#stats table");
    table.innerHTML = '';

    stats.forEach(([k, v]) => {
        console.log(k + ":", v);
        let tr = table.insertRow();
        tr.insertCell().innerText = k;
        tr.insertCell().innerText = v;
    });
}

function add_error(id1, id2) {
    state.successes[id1] = -5;
    state.card_exclusions[id1] ||= {};
    state.card_exclusions[id1][id2] ||= 0;
    state.card_exclusions[id1][id2] += 1;
}

let errors = 0;

let audios = [];
let audio_i = 0;
let current_audio = null;

function clamp_audio_i() {
    audio_i = mod(audio_i, audios.length) || 0;
}

function clear_errors() {
    document.querySelectorAll('.error').forEach(el => {
        el.classList.remove('error');
    });
}

function add_key_class(el, key) {
    el.classList.add(`key-${key.charCodeAt(0)}`);
}

function create_key_el(key) {
    let key_el = document.createElement('span');
    key_el.classList.add('key');
    key_el.innerText = key.toUpperCase();
    return key_el;
}

function add_key(el, key) {
    el.prepend(create_key_el(key));
    add_key_class(el, key);
}

function hide(query) {
    let el =  document.querySelector(query);
    if (!el.classList.contains('hidden')) {
        state.hide_counters[query] ||= 0;
        state.hide_counters[query]++;
        el.classList.add('hidden');
    }
}

function unhide(query) {
    state.hide_counters[query] ||= 0;
    if (state.hide_counters[query] < 10) {
        document.querySelector(query).classList.remove('hidden');
    }
}

function finish_round() {
    unhide('#tutorial-new-round');
    if (errors < 1) {
        if (state.n_cards < 12 || state.difficulty_factor > 3) {
            state.n_cards++;
        }
        if (state.n_cards > 10) {
            state.difficulty_factor += 0.05;
        }
    } else if (errors > 1) {
        state.n_cards--;
        state.difficulty_factor -= 0.1;
    }
    errors = 0;

    save();
    show_notes();
}

function show_notes() {
    unhide('#tutorial-listen');

    let display_notes = get_display_notes();
    log_status();

    console.log(sort_by(x=>x, display_notes.map(x => [x.encounter, x.failure])));

    let ens_el = document.querySelector('#ens');

    shuffle(display_notes);

    display_notes.forEach((note, i) => {
        let audio_el = document.createElement('audio');
        audio_el.id = "card_" + note.sound;
        audio_el.src = deck_prefix + 'sound/' + note.sound;
        audio_el.addEventListener('play', () => {
            document.querySelector("#controls").classList.add('playing');
        });
        audio_el.addEventListener('ended', () => {
            document.querySelector("#controls").classList.remove('playing');
        });
        audios.push(audio_el);
    });


    display_notes.toSorted((a, b) =>
        a.english < b.english ? -1 : b.english < a.english ? 1 : 0
    ).forEach((note, i) => {
        let card_el = document.createElement('div');
        card_el.classList.add('card');
        card_el.id = "card_" + note.sound;

        let img_el = document.createElement('img');
        img_el.src = deck_prefix + 'images/' + (note.img || 'placeholder.png');
        card_el.append(img_el);

        let label_el = document.createElement('div');
        label_el.classList.add('label');
        let inner_label_el = document.createElement('div');
        inner_label_el.innerText = note.english;
        add_key(inner_label_el, String.fromCharCode('a'.charCodeAt(0) + i));
        label_el.append(inner_label_el);
        card_el.append(label_el);

        card_el.addEventListener('click', () => {
            if (current_audio) {
                hide('#tutorial-choice');
                unhide('#tutorial-listen');
                state.try_counters[today()] ||= 0;
                state.try_counters[today()]++;
                if (current_audio.id === card_el.id) {
                    unhide('#tutorial-win');
                    audios.splice(audio_i, 1);
                    clamp_audio_i();
                    card_el.remove();
                    clear_errors();

                    let n_cards_left = ens_el.childElementCount;

                    state.successes[card_el.id] ||= 0;
                    state.successes[card_el.id] += n_cards_left;
                    state.encounters[card_el.id] ||= 0;
                    state.encounters[card_el.id]++;

                    if (n_cards_left === 0) {
                        finish_round();
                    }
                } else {
                    unhide('#tutorial-fail');
                    add_error(card_el.id, current_audio.id);
                    add_error(current_audio.id, card_el.id);

                    errors++;
                    card_el.classList.add('error');
                    setTimeout(() => {
                        card_el.classList.remove('error');
                    }, 2000);
                    audio_i++;
                    clamp_audio_i();
                }
                current_audio = null;
            }
        });
        ens_el.append(card_el);
    });
}

function play_audio_i() {
    hide('#tutorial-new-round')
    hide('#tutorial-listen');
    hide('#tutorial-win');
    hide('#tutorial-fail');
    unhide('#tutorial-choice');
    current_audio = audios[audio_i];
    if (current_audio) {
        current_audio.play();
    }
}

function play_next_audio() {
    audio_i++;
    clamp_audio_i();
    play_audio_i();
}

addEventListener('keypress', e => {
    let key_el = document.querySelector(`.key-${e.charCode}`);
    if (key_el) {
        key_el.click();
    }
    if (e.key === ' ') {
        e.preventDefault();
        play_audio_i();
    }
});

addEventListener('keyup', e => {
    if (e.key === ' ') {
        e.preventDefault();
    }
});

addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        play_next_audio();
    }
});

let status_day = today();

addEventListener('visibilitychange', () => {
    let t = today();
    if (t !== status_day) {
        log_status();
        status_day = t;
    }
});
