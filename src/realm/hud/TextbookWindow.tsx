/**
 * The enchanted textbook (library desk): upload a lecture file and get a
 * summary scroll, flashcards to flip, and a quiz added to the subject. The
 * flashcards join the subject's key terms (so they also feed secret doors and
 * spell names); the quiz joins that week's trial questions.
 */

import { useState } from "react";
import { Window } from "./Window";
import { useRealm } from "../state/store";
import { extractDocumentText } from "../curriculum/curriculumClient";
import { enchant, type Textbook } from "../curriculum/textbook";
import { setSlideQuestions, updateSubject } from "../state/actions";
import { chat } from "../state/events";

export function TextbookWindow({ onClose }: { onClose: () => void }) {
  const subjects = useRealm((s) => s.curriculum?.subjects ?? []);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const subject = subjects.find((s) => s.id === subjectId);
  const [week, setWeek] = useState<number>(subject?.weeks[0]?.week ?? 1);
  const [book, setBook] = useState<Textbook | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const read = async (file: File) => {
    if (!subject) return;
    setBusy(true);
    setError(null);
    try {
      const text = await extractDocumentText(file);
      if (text.trim().length < 200) throw new Error("There's almost no text in that file (scanned slides are pictures, not text).");
      const b = enchant(text, `${subject.id}-s${week}-book-`, week);
      setBook(b);
      setCard(0);
      setFlipped(false);
      // Flashcards join the subject's key terms; the quiz joins the week's trial.
      const known = new Set(subject.keyTerms.map((t) => t.term.toLowerCase()));
      const fresh = b.cards.filter((c) => !known.has(c.term.toLowerCase()));
      if (fresh.length) updateSubject(subject.id, (s) => ({ ...s, keyTerms: [...s.keyTerms, ...fresh] }));
      if (b.quiz.length) setSlideQuestions(subject.id, week, b.quiz);
      chat(`The textbook comes alive: ${b.cards.length} flashcards and ${b.quiz.length} quiz questions for ${subject.name}, week ${week}.`, "quest");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file couldn't be read.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Window title="Enchanted textbook" onClose={onClose} width={760} className="textbook-window">
      <div className="row">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code ? `${s.code}: ` : ""}
              {s.name}
            </option>
          ))}
        </select>
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))} aria-label="Week">
          {(subject?.weeks ?? []).map((w) => (
            <option key={w.week} value={w.week}>
              Week {w.week}: {w.title}
            </option>
          ))}
        </select>
        <label className="rs-button small">
          {busy ? "Reading…" : "Upload a lecture"}
          <input type="file" accept=".pdf,.pptx,.docx,.txt,.md" hidden disabled={busy} onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
        </label>
      </div>
      {error ? <p className="bad">{error}</p> : null}
      {!book ? (
        <p className="muted">Upload a PDF, PowerPoint, Word or text file from your subject. Everything is read on this device.</p>
      ) : (
        <div className="book">
          <section className="parchment scroll">
            <h3>Summary scroll</h3>
            {book.summary.length ? (
              <ul>
                {book.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Not enough full sentences to summarise (slides are often bullet points).</p>
            )}
          </section>
          <section>
            <h3>
              Flashcards {book.cards.length ? `(${card + 1}/${book.cards.length})` : ""}
            </h3>
            {book.cards.length ? (
              <>
                <button type="button" className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((f) => !f)} aria-label="Flip card">
                  {flipped ? book.cards[card].definition : book.cards[card].term}
                </button>
                <div className="row">
                  <button type="button" className="rs-button secondary small" onClick={() => { setCard((c) => (c - 1 + book.cards.length) % book.cards.length); setFlipped(false); }}>
                    ‹ Prev
                  </button>
                  <button type="button" className="rs-button secondary small" onClick={() => { setCard((c) => (c + 1) % book.cards.length); setFlipped(false); }}>
                    Next ›
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">No definition-style lines found. Notes written as “Term: meaning” work best.</p>
            )}
            <p className="small">
              {book.quiz.length
                ? `${book.quiz.length} quiz questions were added to week ${week}'s trial at its waystone.`
                : "A quiz needs at least four flashcards."}
            </p>
          </section>
        </div>
      )}
    </Window>
  );
}
