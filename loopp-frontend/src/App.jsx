import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "./routes";
import { bootstrapAuthThunk } from "@/features/auth/authSlice";

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    queueMicrotask(() => dispatch(bootstrapAuthThunk()));
  }, [dispatch]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        richColors
        closeButton
        position="top-right"
        offset={24} // space from the top
        toastOptions={{
          style: {
            borderRadius: "10px",
            padding: "12px 16px",
            boxShadow:
              "0 10px 30px -10px rgba(0,0,0,0.35), 0 4px 12px -6px rgba(0,0,0,0.2)",
          },
        }}
      />
    </>
  );
}
