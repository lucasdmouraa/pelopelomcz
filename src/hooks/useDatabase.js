import { useState, useEffect, useCallback } from "react";
import { registerVote, registerNewEmail } from "@/services/supabase";
import { scrollTo } from "@/utils";

const updateColorTheme = (n) => {
  let root = document.documentElement;
  root.style.setProperty("--base", `var(--base-${n})`);
  root.style.setProperty("--primary", `var(--primary-${n})`);
  root.style.setProperty("--secondary", `var(--secondary-${n})`);
};

export const useDatabase = () => {
  const [selected, setSelected] = useState(1);
  const [voted, setVoted] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const pastVote = localStorage.getItem("vote");
    if (pastVote) {
      setVoted(true);
      setSelected(+pastVote);
    }
  }, []);

  useEffect(() => {
    const pastSubscription = localStorage.getItem("subscribed");
    if (pastSubscription) {
      setSubscribed(true);
    }
  }, []);

  useEffect(() => {
    updateColorTheme(selected);
  }, [selected]);

  const vote = useCallback(() => {
    if (!voted) {
      setVoted(true);
      registerVote(selected).then();
      localStorage.setItem("vote", selected);
      scrollTo("poll");
    }
  }, [selected, voted, setVoted]);

  const subscribe = useCallback(
    (email) => {
      registerNewEmail(email).then();
      setSubscribed(true);
      localStorage.setItem("subscribed", "yes baby");
    },
    [setSubscribed],
  );

  return { vote, voted, selected, setSelected, subscribe, subscribed };
};
