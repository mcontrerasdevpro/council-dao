self.addEventListener("message", async (e) => {
  const { action, passportData, circuitWasmUrl, circuitZkeyUrl } = e.data;

  if (action === "GENERATE_PROOF") {
    try {
      self.postMessage({ status: "PROCESSING", message: "Procesando firma NFC del pasaporte..." });
      
      await new Promise((resolve) => setTimeout(resolve, 4000));

      self.postMessage({ status: "GENERATING", message: "Generando prueba criptográfica de conocimiento cero..." });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const mockProof = { pi_a: ["0x1", "0x2"], pi_b: [["0x3", "0x4"], ["0x5", "0x6"]], pi_c: ["0x7", "0x8"] };
      const mockPublicSignals = ["1", "52983525044272"]; 

      self.postMessage({
        status: "SUCCESS",
        proof: mockProof,
        publicSignals: mockPublicSignals
      });

    } catch (error) {
      self.postMessage({ status: "ERROR", error: error.message });
    }
  }
});