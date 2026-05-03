import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";

jest.mock("axios", () => ({
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn()
}));

jest.mock("socket.io-client", () => {
  const mockCreateSocket = jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn()
  }));

  return {
    __esModule: true,
    default: mockCreateSocket,
    io: mockCreateSocket
  };
});

const App = require("./App").default;

beforeEach(() => {
  axios.get.mockResolvedValue({ data: [] });
});

afterEach(() => {
  jest.clearAllMocks();
});

test("renders the smart hostel dashboard and loads analytics", async () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /smart hostel dashboard/i })
  ).toBeInTheDocument();

  await waitFor(() => {
    expect(axios.get).toHaveBeenCalledWith("http://localhost:5000/analytics/timeseries");
  });
});
