import React from "react";
import type { CustomMessageCard as CustomMessageCardType } from "@shared";
import { legacyCustomMessageCardToGeneratedUi } from "../../utils/generated-ui";
import { GeneratedUiCard } from "./GeneratedUiCard";

interface CustomMessageCardProps {
  card: CustomMessageCardType;
}

export function CustomMessageCard({ card }: CustomMessageCardProps): React.JSX.Element {
  return <GeneratedUiCard card={legacyCustomMessageCardToGeneratedUi(card)} badgeLabel={card.kind} />;
}
