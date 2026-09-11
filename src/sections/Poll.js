"use client";

import { useRef, useState } from "react";
import { useDatabase } from "@/hooks";
import c from "clsx";
import styles from "./Poll.module.css";

const options = [1, 2, 3, 4, 5];

export const Poll = () => {
  const [preventVote, setPreventVote] = useState(true);
  const { vote, voted, selected, setSelected, subscribe, subscribed } =
    useDatabase();
  const emailInputRef = useRef(null);

  const handleSubscriptionSubmit = (ev) => {
    ev.preventDefault();
    const { value: email } = emailInputRef.current;
    if (email) {
      subscribe(email);
    }
  };

  const handleSelected = (option) => {
    setPreventVote(false);
    setSelected(option);
  };

  return (
    <section class="colored-section" id="poll">
      <div class={c("colored-section-content", styles.content)}>
        {!voted && (
          <>
            <h2>Escolha um focinho para ser a nossa cara:</h2>

            <div class={styles.options}>
              {options.map((option) => (
                <div
                  key={option}
                  class={c(
                    styles.option,
                    selected === option && styles.selected,
                  )}
                  onClick={() => handleSelected(option)}
                >
                  <img src={`${option}.png`} />
                  <img src="tipografia.png" />
                </div>
              ))}
            </div>
            <button
              disabled={preventVote}
              class={styles.voteButton}
              onClick={vote}
            >
              Votar
            </button>
          </>
        )}

        {voted && (
          <div class={styles.feedback}>
            <img src={`voted-${selected}.png`} />
            <div>
              <h2>Obrigado por ajudar na escolha de nosso focinho</h2>

              {!subscribed && (
                <>
                  <p>
                    Deixe seu e-mail aqui para ficar por dentro das últimas
                    novidades e informações do projeto <b>PeloPelo</b>.
                  </p>
                  <form onSubmit={handleSubscriptionSubmit}>
                    <input
                      ref={emailInputRef}
                      type="email"
                      required
                      placeholder="Digite aqui o seu Email"
                    />
                    <button type="submit">Inscrever-se</button>
                  </form>
                </>
              )}

              {subscribed && (
                <p>
                  <b>
                    Obrigado novamente! Seu estusiasmo nos motiva bastante a
                    seguir adiante.
                  </b>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
