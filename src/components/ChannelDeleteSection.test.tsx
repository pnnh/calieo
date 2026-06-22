// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import ChannelDeleteSection from "@/components/ChannelDeleteSection";

const labels = {
    deleteChannel: "Delete Channel",
    deleteChannelConfirm: "Really delete this channel?",
    deleteChannelHasFiles: "Cannot delete: channel has published files.",
};

function setup(channelId = "ch-001") {
    return render(
        <ChannelDeleteSection
            lang="en"
            channelId={channelId}
            redirectTo="/en/console/channels"
            labels={labels}
        />
    );
}

beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
        value: { href: "" },
        writable: true,
        configurable: true,
    });
});

describe("ChannelDeleteSection", () => {
    it("renders the delete button with the correct label", () => {
        const { getByRole } = setup();
        expect(getByRole("button", { name: labels.deleteChannel })).toBeTruthy();
    });

    it("shows no error message initially", () => {
        const { queryByRole } = setup();
        // No alert or paragraph with error text
        expect(queryByRole("alert")).toBeNull();
    });

    it("does NOT call fetch when confirm is cancelled", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(false);
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        const { getByRole } = setup();
        fireEvent.click(getByRole("button", { name: labels.deleteChannel }));

        await new Promise((r) => setTimeout(r, 0));
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("calls DELETE on the correct console URL when confirmed", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal("fetch", fetchSpy);

        const { getByRole } = setup("ch-xyz");
        fireEvent.click(getByRole("button", { name: labels.deleteChannel }));

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenCalledWith(
                "/en/console/channels/ch-xyz/actions",
                { method: "DELETE" }
            );
        });
    });

    it("redirects to redirectTo when delete succeeds", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

        const { getByRole } = setup();
        fireEvent.click(getByRole("button", { name: labels.deleteChannel }));

        await waitFor(() => {
            expect(window.location.href).toBe("/en/console/channels");
        });
    });

    it("shows the error message from the response body when delete fails", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ error: "Channel has published files" }),
            })
        );

        const { getByRole, findByText } = setup();
        fireEvent.click(getByRole("button", { name: labels.deleteChannel }));

        expect(await findByText("Channel has published files")).toBeTruthy();
        expect(window.location.href).toBe("");
    });

    it("shows the fallback label error when response body has no error field", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({}),
            })
        );

        const { getByRole, findByText } = setup();
        fireEvent.click(getByRole("button", { name: labels.deleteChannel }));

        expect(await findByText(labels.deleteChannelHasFiles)).toBeTruthy();
    });

    it("shows confirm message from labels", () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
        vi.stubGlobal("fetch", vi.fn());

        const { getByRole } = setup();
        fireEvent.click(getByRole("button", { name: labels.deleteChannel }));

        expect(confirmSpy).toHaveBeenCalledWith(labels.deleteChannelConfirm);
    });
});
