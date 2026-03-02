package uz.reestrmkd.backendjpa.domain;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "entrance_matrix")
public class EntranceMatrixEntity extends BaseEntity {
    @Column(name = "block_id", nullable = false) private String blockId;
    @Column(name = "floor_id", nullable = false) private String floorId;
    @Column(name = "entrance_number", nullable = false) private Integer entranceNumber;
    @Column(name = "flats_count") private Integer flatsCount = 0;
    @Column(name = "commercial_count") private Integer commercialCount = 0;
    @Column(name = "mop_count") private Integer mopCount = 0;
}