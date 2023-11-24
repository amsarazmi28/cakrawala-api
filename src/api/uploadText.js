exports.uploadText = async (req, res) => {
  const { text } = req.body;

  if (!text) {
    const response = res.status(400).send({
      status: "Gagal",
      message: "Semua ketentuan wajib diisi!",
    });
    return response;
  }

  if (text.length > 2000) {
    const response = res.status(400).send({
      status: "Gagal",
      message: "Panjang teks tidak boleh lebih dari 2000 karakter!",
    });
    return response;
  }

  const response = res.status(201).send({
    status: "Sukses",
    message: req.body.text,
  });

  return response;
};
