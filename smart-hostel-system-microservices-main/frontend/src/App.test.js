import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import API from "./api";

jest.mock("./api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn()
  }
}));

const successResponse = { data: [] };

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    API.get.mockResolvedValue(successResponse);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("renders login screen when user is unauthenticated", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /smart hostel/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter username/i)).toBeInTheDocument();
  });

  test("renders dashboard and loads data for authenticated users", async () => {
    localStorage.setItem("token", "invalid-token-for-test");
    render(<App />);

    await waitFor(() => {
      expect(API.get).toHaveBeenCalled();
    });
    expect(screen.getByRole("heading", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analytics/i })).toBeInTheDocument();
  });
});
