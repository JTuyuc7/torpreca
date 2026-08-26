import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Home from "./page";

describe("Home page", () => {
  test("renders the getting-started heading", () => {
    render(<Home />);

    expect(screen.getByText(/edit the/i)).toBeInTheDocument();
  });
});