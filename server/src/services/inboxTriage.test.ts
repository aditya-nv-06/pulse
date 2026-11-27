import OpenAI from "openai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  redactRequesterDetails,
  triageInboxText,
  validateTriageSuggestions,
} from "./inboxTriage.js"

const suggestion = {
  title: "Add dark mode",
  summary: "Let customers use a dark color theme at night.",
  matchedPostId: "post-1",
  confidence: 0.91,
}

const toolResponse = (argumentsText: string) => ({
  choices: [
    {
      message: {
        tool_calls: [
          {
            type: "function",
            function: { name: "submit_triage", arguments: argumentsText },
          },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
})

const mockClient = (...responses: ReturnType<typeof toolResponse>[]) =>
  ({
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => responses.shift()),
      },
    },
  }) as unknown as OpenAI

describe("Inbox triage validation", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  it("accepts valid suggestions and keeps supplied matches", () => {
    expect(validateTriageSuggestions({ requests: [suggestion] }, new Set(["post-1"]))).toEqual({
      requests: [suggestion],
    })
  })

  it("clears a matched post id not supplied to the model", () => {
    expect(
      validateTriageSuggestions({ requests: [suggestion] }, new Set(["another-post"])).requests[0]
        ?.matchedPostId,
    ).toBeNull()
  })

  it("redacts requester identity before sending feedback to the model", () => {
    expect(
      redactRequesterDetails(
        "Alex says dark mode would help. Contact Alex at alex@example.com.",
        "Alex",
        "alex@example.com",
      ),
    ).toBe(
      "[requester detail] says dark mode would help. Contact [requester detail] at [email address].",
    )
  })

  it("retries once after malformed tool JSON", async () => {
    const client = mockClient(
      toolResponse("{malformed"),
      toolResponse(JSON.stringify({ requests: [suggestion] })),
    )
    const result = await triageInboxText(
      "Please add dark mode",
      [{ id: "post-1", title: "Dark mode" }],
      {
        client,
      },
    )
    expect(result.requests).toEqual([suggestion])
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2)
    expect(client.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.2,
        tool_choice: { type: "function", function: { name: "submit_triage" } },
      }),
    )
  })
})
