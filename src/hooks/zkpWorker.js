self.addEventListener("message", async (e) => {
  const { action, passportData, circuitWasmUrl, circuitZkeyUrl } = e.data;

  if (action === "GENERATE_PROOF") {
    try {
      // 1. Notificamos a la UI que empezamos el procesamiento de la biometría
      self.postMessage({ status: "PROCESSING", message: "Procesando firma NFC del pasaporte..." });

      // En un entorno de producción, aquí importarías snarkjs de forma dinámica:
      // importScripts("https://cloudflare.com");
      
      // Simulación del cálculo matemático pesado (Ej: Emparejamiento en curvas BN254)
      // Esto previene que la interfaz visual de React sufra caídas de FPS o congelamientos
      await new Promise((resolve) => setTimeout(resolve, 4000));

      self.postMessage({ status: "GENERATING", message: "Generando prueba criptográfica de conocimiento cero..." });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 2. Componemos los outputs del circuito criptográfico (Proof y Public Signals)
      const mockProof = { pi_a: ["0x1", "0x2"], pi_b: [["0x3", "0x4"], ["0x5", "0x6"]], pi_c: ["0x7", "0x8"] };
      const mockPublicSignals = ["1", "52983525044272"]; // El nullifier para evitar doble voto y verificación de nacionalidad

      // 3. Devolvemos el resultado con éxito
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