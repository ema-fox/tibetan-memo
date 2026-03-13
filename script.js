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

function bubble_max(xs, f) {
    let end_i =  xs.length - 1
    let max_i = end_i;
    let max_score = f(xs[max_i]);
    for (let i = 0; i < end_i - 1; i++) {
        let i_score = f(xs[i]);
        if (max_score < i_score) {
            max_i = i;
            max_score = i_score;
        }
    }

    let tmp = xs[end_i];
    xs[end_i] = xs[max_i];
    xs[max_i] = tmp;
}

function merge_with(a, b, f) {
    Object.entries(b).forEach(([k, v]) => {
        if (a.hasOwnProperty(k)) {
            a[k] = f(a[k], v);
        } else {
            a[k] = v
        }
    });
    return a;
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
    difficulty_factor: 0,
    try_counters: {},
    hide_counters: {},
    success_tokens: {"བཀྲ ཤིས": 1,
                     "བདེ ལེགས": 1},
    fail_tokens: {},
    last_heard: {},

    ...JSON.parse(localStorage.getItem('tibetan-memo-state'), "")};

let deck_prefix = "https://ema-fox.github.io/tibetan-deck/";

let notes = [];
let notes_by_id = {};

async function load_notes() {
    notes = (await (await fetch(deck_prefix + 'cards.json')).json())
        .filter(note => !note.disabled)
        .map(note => {
            let tokens = {};
            get_tokens(note).forEach(token => {
                tokens[token] = 1; // only count duplicated tokens once
            });
            return {
                id: 'card_' + (note.id || note.sound),
                tokens: tokens,
                ...note
            };
        });
    notes.forEach(note => {
        notes_by_id[note.id] = note;
    });
}

function save() {
    localStorage.setItem('tibetan-memo-state', JSON.stringify(state));
}

function plus(a, b) {
    return a + b;
}

function sum(xs) {
    return xs.reduce(plus, 0);
}

function prod(xs) {
    return xs.reduce((a, b) => a * b, 1);
}

function mean(xs) {
    return sum(xs) / xs.length;
}

function geo_mean(xs) {
    return Math.pow(prod(xs), 1 / xs.length);
}

function token_score(token) {
    let win = 1 + (state.success_tokens[token] || 0);
    let fail = 7 + (state.fail_tokens[token] || 0);
    return win / (win + fail);
}

function note_score(note) {
    return geo_mean(Object.keys(note.tokens).map(token_score));
}

function enriched_notes() {
    return notes.map(note => {
        let score = note_score(note);
        return {score, ...note};
    });
}

function get_tokens(note) {
    let tokens = note.uchen.split(/[་། ]+/).filter(s => s.length);
    return tokens.concat(tokens.slice(0, -1).map((a, i) => `${a} ${tokens[i + 1]}`));
}

function add_bags(xs) {
    return xs.reduce((a, b) => merge_with(a, b, plus), {});
}

function sleep_seconds() {
    return 10 * Math.pow(2, 1 + state.difficulty_factor / 2) | 0
}

function sleep_cutoff() {
    return now() - 1000 * sleep_seconds();
}

function get_display_notes() {
    let cutoff = sleep_cutoff();
    let candidates = notes.filter(note => (state.last_heard[note.id] || 0) < cutoff);
    console.log(notes.length - candidates.length, candidates.length);
    let res = [];

    let used_tokens = {};

    while (candidates.length && res.length < state.n_cards) {
        bubble_max(candidates, note => {
            let score = 1;
            Object.keys(note.tokens).forEach(token => {
                if (used_tokens[token]) {
                    // token is already used in a display note;
                    score *= 1/8;
                } else {
                    let ts = token_score(token);
                    //console.log(ratio);
                    if (ts < 0.9) {
                        score *= ts;
                    } else {
                        // we know this token well so don't need to prioritze it;
                        //console.log(token);
                        score *= 1/8
                    }
                }
            });
            return Math.pow(score, 1 / Object.keys(note.tokens).length);
        });
        let note = candidates.pop();
        used_tokens = {...used_tokens, ...note.tokens};
        res.push(note);
    }
    return res;
}

function render_duration(d) {
    let rounded = d.round({largestUnit: 'days'});
    let components = [
        {amount: rounded.days, unit: 'days'},
        {amount: rounded.hours, unit: 'hours'},
        {amount: rounded.minutes, unit: 'minutes'},
        {amount: rounded.seconds, unit: 'seconds'}
    ];

    while (components.length && components[0].amount === 0) {
        components.shift();
    }

    let result = `${components[0].amount} ${components[0].unit}`;

    if (components[0].amount < 10 && components[1] && components[1].amount !== 0) {
        result += ` and ${components[1].amount} ${components[1].unit}`;
    }

    return result;
}

function log_status() {
    let cutoff = sleep_cutoff();
    let sleeping_notes = notes.filter(note => (state.last_heard[note.id] || 0) > cutoff)

    let n_all_cards = notes.length;

    let success = sleeping_notes.length;
    let goal_success = notes.length;

    let prog_el = document.querySelector('#progress');
    prog_el.max = goal_success;
    prog_el.value = success;

    let all_tries = sum(Object.values(state.try_counters));
    let today_tries = state.try_counters[today()] || 0;

    let speed = success / all_tries;

    let learned_today = today_tries * speed | 0;

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

    console.log("success:", success);

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
        //["novelty", (10 * state.difficulty_factor | 0) / 10],
        ["loop", render_duration(Temporal.Duration.from({seconds: sleep_seconds()}))],
        //["speed", speed | 0],
        //["learned today", learned_today],
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
        if (state.n_cards < 12) {
            state.n_cards++;
        }
        if (state.difficulty_factor < 50) {
            if (state.n_cards > 10) {
                state.difficulty_factor += 1;
            } else {
                state.difficulty_factor += 0.5;
            }
        }
    } else if (errors > 1) {
        state.n_cards--;
        if (state.n_cards > 10) {
            state.difficulty_factor -= 0.5;
        } else {
            state.difficulty_factor -= 1;
        }
    }
    errors = 0;

    save();
    show_notes();
}

function show_notes() {
    unhide('#tutorial-listen');

    let display_notes = get_display_notes();
    log_status();

    let ens_el = document.querySelector('#ens');

    shuffle(display_notes);

    display_notes.forEach((note, i) => {
        let audio_el = document.createElement('audio');
        audio_el.id = note.id;
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
        card_el.id = note.id;

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

                state.last_heard[card_el.id] = now();

                let n_cards_left = ens_el.childElementCount;

                //console.log(ens_el.childElements);
                let bla = add_bags([].map.call(ens_el.childNodes, card => notes_by_id[card.id].tokens));

                let win = {};
                let fail = {};

                Object.keys(notes_by_id[current_audio.id].tokens).forEach(token => {
                    let prevalence = bla[token] / n_cards_left;

                    if (notes_by_id[card_el.id].tokens[token]) {

                        state.success_tokens[token] ||= 0;
                        state.success_tokens[token] += 1 - prevalence;
                        win[token] = 1 - prevalence;
                    } else {
                        state.fail_tokens[token] ||= 0;
                        state.fail_tokens[token] += prevalence;
                        fail[token] = prevalence;
                    }
                });


                if (current_audio.id === card_el.id) {
                    unhide('#tutorial-win');
                    audios.splice(audio_i, 1);
                    clamp_audio_i();
                    card_el.remove();
                    clear_errors();

                    let n_cards_left = ens_el.childElementCount;

                    if (n_cards_left === 0) {
                        finish_round();
                    }
                } else {
                    unhide('#tutorial-fail');

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
