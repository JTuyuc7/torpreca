import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContinueForm } from "./continue-form";

describe("ContinueForm", () => {
  it("posts the token to /auth/confirm through a Continue button", () => {
    const { container } = render(<ContinueForm tokenHash="abc123" type="invite" />);

    const form = container.querySelector("form");
    expect(form?.getAttribute("method")?.toUpperCase()).toBe("POST");
    expect(form?.getAttribute("action")).toBe("/auth/confirm");
    expect(container.querySelector('input[name="token_hash"]')?.getAttribute("value")).toBe(
      "abc123",
    );
    expect(container.querySelector('input[name="type"]')?.getAttribute("value")).toBe("invite");
    expect(screen.getByRole("button").getAttribute("type")).toBe("submit");
  });
});
