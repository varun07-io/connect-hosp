import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import type { EnquiryIntent } from "@connect-hospital/shared";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";

interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

interface Props {
  enquiryId: string;
  /** Shown on the button so the patient sees exactly what they're paying. */
  amount?: number;
  intent?: EnquiryIntent;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  onSuccess: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: object) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function RazorpayCheckout({ enquiryId, amount, intent, patientName, patientEmail, patientPhone, onSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const createOrder = useMutation({
    mutationFn: () =>
      apiFetch<RazorpayOrder>("/api/payments/orders", {
        method: "POST",
        body: JSON.stringify({ enquiryId }),
      }),
  });

  const verifyPayment = useMutation({
    mutationFn: (data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
      apiFetch("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      setIsProcessing(false);
      queryClient.invalidateQueries({ queryKey: ["patient"] });
      onSuccess();
      toast({ title: "Payment successful", description: "Your deposit has been received." });
    },
    onError: () => {
      setIsProcessing(false);
      toast({ title: "Payment verification failed", variant: "destructive" });
    },
  });

  async function handlePay() {
    setIsProcessing(true);
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setIsProcessing(false);
      toast({ title: "Could not load payment gateway", variant: "destructive" });
      return;
    }

    let order: RazorpayOrder;
    try {
      order = await createOrder.mutateAsync();
    } catch (err) {
      setIsProcessing(false);
      toast({
        title: "Couldn't start payment",
        description: err instanceof ApiError ? err.message : "Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount * 100,
      currency: order.currency,
      order_id: order.orderId,
      name: "Connect Hospital",
      description: intent === "SECOND_OPINION" ? "Second opinion deposit (refundable)" : "Surgery booking deposit (refundable)",
      prefill: { name: patientName, email: patientEmail, contact: patientPhone },
      theme: { color: "#0f7c82" },
      handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        verifyPayment.mutate({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => setIsProcessing(false),
      },
    });

    rzp.open();
  }

  return (
    <Button onClick={handlePay} disabled={isProcessing} size="lg" className="w-full">
      {isProcessing ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
      ) : (
        <><CreditCard className="h-4 w-4" /> Pay {amount ? formatCurrency(amount) : "deposit"} securely</>
      )}
    </Button>
  );
}
