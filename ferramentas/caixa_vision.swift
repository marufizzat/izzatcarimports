// Recorte do primeiro plano (Vision) em laço: uma linha "entrada\tsaida.png" por foto no stdin,
// responde OK | SEM (nenhum primeiro plano) | ERRO n. O modelo carrega uma vez só.
import Foundation
import Vision
import CoreImage

let contexto = CIContext()
let espaco = CGColorSpace(name: CGColorSpace.sRGB)!
setvbuf(stdout, nil, _IOLBF, 0)
while let linha = readLine() {
    let partes = linha.components(separatedBy: "\t")
    if partes.count != 2 { print("ERRO 2"); continue }
    let resposta: String = autoreleasepool {
        guard let imagem = CIImage(contentsOf: URL(fileURLWithPath: partes[0])) else { return "ERRO 3" }
        let handler = VNImageRequestHandler(ciImage: imagem, options: [:])
        let pedido = VNGenerateForegroundInstanceMaskRequest()
        do { try handler.perform([pedido]) } catch { return "ERRO 4" }
        guard let r = pedido.results?.first else { return "SEM" }
        do {
            let buf = try r.generateMaskedImage(ofInstances: r.allInstances, from: handler, croppedToInstancesExtent: false)
            try contexto.writePNGRepresentation(of: CIImage(cvPixelBuffer: buf), to: URL(fileURLWithPath: partes[1]), format: .RGBA8, colorSpace: espaco)
            return "OK"
        } catch { return "ERRO 7" }
    }
    print(resposta)
}
