import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  test("renders the placeholder for the not-yet-built panel principal", () => {
    render(<HomePage />);

    expect(screen.getByText("Panel principal")).toBeInTheDocument();
    expect(document.title).toBe("Panel principal · Torpreca");
  });
});